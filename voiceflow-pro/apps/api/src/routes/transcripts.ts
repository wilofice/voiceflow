import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '@voiceflow-pro/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const createTranscriptSchema = z.object({
  uploadId: z.string().uuid(),
  title: z.string().optional(),
  language: z.string().default('en'),
});

const updateTranscriptSchema = z.object({
  title: z.string().optional(),
  segments: z.array(z.object({
    id: z.string().uuid(),
    text: z.string(),
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

    return reply.send({
      transcript,
    });
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
      },
      select: {
        id: true,
        title: true,
        updatedAt: true,
      },
    });

    // Update segments if provided
    if (updates.segments) {
      await Promise.all(
        updates.segments.map(segment =>
          prisma.transcriptSegment.update({
            where: { id: segment.id },
            data: { text: segment.text },
          })
        )
      );
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
}