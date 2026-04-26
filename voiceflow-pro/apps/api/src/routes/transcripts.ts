import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '@voiceflow-pro/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { TranscriptionService } from '../services/transcription';
import { transcriptionQueue } from '../services/queue';
import { getSignedUrl, AUDIO_BUCKET } from '../lib/supabase';
import * as fs from 'fs';

const createTranscriptSchema = z.object({
  uploadId: z.string().uuid(),
  title: z.string().optional(),
  language: z.string().default('en'),
});

const updateTranscriptSchema = z.object({
  title: z.string().optional(),
  status: z.enum(['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED']).optional(),
  segments: z.array(z.object({
    text: z.string(),
    start: z.number().optional(),
    end: z.number().optional(),
    confidence: z.number().optional(),
  })).optional(),
});

const querySchema = z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
  status: z.enum(['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED']).optional(),
});

export async function transcriptRoutes(fastify: FastifyInstance) {
  // Get all transcripts for user
  fastify.get('/', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const query = querySchema.parse(request.query);

    const where = {
      userId: request.user.id,
      deletedAt: null,
      ...(query.status && { status: query.status }),
    };

    const [transcripts, total] = await Promise.all([
      prisma.transcript.findMany({
        where,
        select: {
          id: true,
          title: true,
          duration: true,
          language: true,
          status: true,
          audioUrl: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.transcript.count({ where }),
    ]);

    const totalPages = Math.ceil(total / query.limit);

    return reply.send({
      transcripts,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPreviousPage: query.page > 1,
      },
    });
  });

  // Create transcript from upload
  fastify.post('/', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { uploadId, title, language } = createTranscriptSchema.parse(request.body);

    // Verify the upload exists and belongs to the user
    const existingTranscript = await prisma.transcript.findFirst({
      where: {
        id: uploadId,
        userId: request.user.id,
      },
    });

    if (!existingTranscript) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'Upload not found',
        },
      });
    }

    // Update the transcript with new details
    const transcript = await prisma.transcript.update({
      where: { id: uploadId },
      data: {
        title: title || existingTranscript.title,
        language,
        status: 'QUEUED',
      },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
      },
    });

    // TODO: Queue for transcription processing

    return reply.send({
      transcript,
    });
  });

  // Get specific transcript with segments
  fastify.get('/:id', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const transcript = await prisma.transcript.findFirst({
      where: {
        id,
        userId: request.user.id,
        deletedAt: null,
      },
      include: {
        segments: {
          orderBy: { startTime: 'asc' },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!transcript) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'Transcript not found',
        },
      });
    }

    if (transcript.audioUrl) {
      transcript.audioUrl = `http://localhost:3002/api/transcripts/${transcript.id}/audio`;
    }

    return reply.send({
      transcript,
    });
  });

  // Proxy endpoint to stream or secure-redirect the audio media directly to the React Audio Tag
  fastify.get('/:id/audio', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const transcript = await prisma.transcript.findUnique({
      where: { id },
    });

    if (!transcript || !transcript.audioUrl) {
      return reply.status(404).send('Audio not found');
    }

    if (transcript.audioUrl.startsWith('/')) {
      if (!fs.existsSync(transcript.audioUrl)) {
        return reply.status(404).send('Local audio file missing on disk');
      }
      const stream = fs.createReadStream(transcript.audioUrl);
      const ext = transcript.audioUrl.split('.').pop() || 'mpeg';
      return reply.type(`audio/${ext}`).send(stream);
    } else if (!transcript.audioUrl.startsWith('http') && !transcript.audioUrl.startsWith('file://')) {
      try {
        const signedUrl = await getSignedUrl(AUDIO_BUCKET, transcript.audioUrl);
        return reply.redirect(signedUrl);
      } catch (err: any) {
        request.log.error(err, 'Supabase signed URL error');
        return reply.status(404).send('Audio media unreachable in bucket');
      }
    } else {
      return reply.redirect(transcript.audioUrl);
    }
  });

  // Update transcript
  fastify.put('/:id', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const updates = updateTranscriptSchema.parse(request.body);

    // Verify transcript exists and belongs to user
    const existingTranscript = await prisma.transcript.findFirst({
      where: {
        id,
        userId: request.user.id,
        deletedAt: null,
      },
    });

    if (!existingTranscript) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'Transcript not found',
        },
      });
    }

    // Update transcript
    const transcript = await prisma.transcript.update({
      where: { id },
      data: {
        ...(updates.title && { title: updates.title }),
        ...(updates.status && { status: updates.status }),
      },
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
      },
    });

    // Update segments if provided by deleting old and creating new Xenova results
    if (updates.segments && updates.segments.length > 0) {
      await prisma.transcriptSegment.deleteMany({
        where: { transcriptId: id }
      });

      await prisma.transcriptSegment.createMany({
        data: updates.segments.map((segment) => ({
          transcriptId: id,
          text: segment.text,
          startTime: segment.start || 0,
          endTime: segment.end || 0,
          confidence: segment.confidence || 1.0
        }))
      });
    }

    return reply.send({
      transcript,
    });
  });

  // Delete transcript
  fastify.delete('/:id', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    // Verify transcript exists and belongs to user
    const existingTranscript = await prisma.transcript.findFirst({
      where: {
        id,
        userId: request.user.id,
        deletedAt: null,
      },
    });

    if (!existingTranscript) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'Transcript not found',
        },
      });
    }

    // Soft delete
    await prisma.transcript.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return reply.send({
      success: true,
    });
  });

  // Get transcript status
  fastify.get('/:id/status', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const transcript = await prisma.transcript.findFirst({
      where: {
        id,
        userId: request.user.id,
        deletedAt: null,
      },
      select: {
        id: true,
        status: true,
        duration: true,
        updatedAt: true,
      },
    });

    if (!transcript) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'Transcript not found',
        },
      });
    }

    return reply.send({
      transcriptId: transcript.id,
      status: transcript.status,
      duration: transcript.duration,
      updatedAt: transcript.updatedAt,
    });
  });

  // Retry failed transcription
  fastify.post('/:id/retry', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    // Verify transcript exists and belongs to user
    const transcript = await prisma.transcript.findFirst({
      where: {
        id,
        userId: request.user.id,
        deletedAt: null,
        status: 'FAILED',
      },
    });

    if (!transcript) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'Failed transcript not found',
        },
      });
    }

    try {
      // Queue for retry
      await transcriptionQueue.addJob(transcript.id, transcript.audioUrl!);

      // Update status to queued
      await prisma.transcript.update({
        where: { id },
        data: { status: 'QUEUED' },
      });

      return reply.send({
        message: 'Transcription retry queued',
        transcriptId: id,
      });
    } catch (error) {
      return reply.status(500).send({
        error: {
          code: 'RETRY_FAILED',
          message: 'Failed to retry transcription',
        },
      });
    }
  });

  // Get transcription cost estimate
  fastify.get('/cost/estimate', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { duration } = request.query as { duration?: string };

    if (!duration) {
      return reply.status(400).send({
        error: {
          code: 'MISSING_DURATION',
          message: 'Duration parameter is required',
        },
      });
    }

    const durationInSeconds = parseInt(duration);
    if (isNaN(durationInSeconds) || durationInSeconds <= 0) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_DURATION',
          message: 'Duration must be a positive number',
        },
      });
    }

    const cost = TranscriptionService.estimateCost(durationInSeconds);

    return reply.send({
      durationInSeconds,
      estimatedCost: cost,
      currency: 'USD',
      pricePerMinute: 0.006,
    });
  });

  // Get queue status (admin endpoint in production)
  fastify.get('/queue/status', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const queueStatus = transcriptionQueue.getQueueStatus();

    return reply.send({
      queue: queueStatus,
      timestamp: new Date().toISOString(),
    });
  });
}