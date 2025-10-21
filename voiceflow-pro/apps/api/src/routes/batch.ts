import { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '@voiceflow-pro/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { uploadFile, AUDIO_BUCKET } from '../lib/supabase';
import { batchQueue } from '../services/batchQueue';

// Request validation schemas
const createBatchJobSchema = z.object({
  name: z.string().min(1).max(255),
  concurrency: z.number().int().min(1).max(10).default(3),
});

const updateBatchJobSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  concurrency: z.number().int().min(1).max(10).optional(),
});

const addFilesToBatchSchema = z.object({
  // Files will come as multipart form data
  // Metadata will be in fields
});

export async function batchRoutes(fastify: FastifyInstance) {

  // 1. Create batch job
  fastify.post('/jobs', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const data = createBatchJobSchema.parse(request.body);

      const batchJob = await prisma.batchJob.create({
        data: {
          userId: request.user.id,
          name: data.name,
          concurrency: data.concurrency,
          status: 'DRAFT',
          totalItems: 0,
          completedItems: 0,
          failedItems: 0,
        },
      });

      return reply.send(batchJob);
    } catch (error) {
      request.log.error(error, 'Failed to create batch job');

      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors,
          },
        });
      }

      return reply.status(500).send({
        error: {
          code: 'CREATE_FAILED',
          message: 'Failed to create batch job',
        },
      });
    }
  });

  // 2. Get all batch jobs (paginated)
  fastify.get('/jobs', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { page = 1, limit = 20, status } = request.query as {
        page?: number;
        limit?: number;
        status?: string;
      };

      const skip = (Number(page) - 1) * Number(limit);

      const where = {
        userId: request.user.id,
        deletedAt: null,
        ...(status && { status }),
      };

      const [jobs, total] = await Promise.all([
        prisma.batchJob.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: 'desc' },
          include: {
            _count: {
              select: { items: true },
            },
          },
        }),
        prisma.batchJob.count({ where }),
      ]);

      return reply.send({
        data: jobs,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      request.log.error(error, 'Failed to fetch batch jobs');

      return reply.status(500).send({
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch batch jobs',
        },
      });
    }
  });

  // 3. Get single batch job with items
  fastify.get('/jobs/:id', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };

      const batchJob = await prisma.batchJob.findFirst({
        where: {
          id,
          userId: request.user.id,
          deletedAt: null,
        },
        include: {
          items: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!batchJob) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Batch job not found',
          },
        });
      }

      return reply.send(batchJob);
    } catch (error) {
      request.log.error(error, 'Failed to fetch batch job');

      return reply.status(500).send({
        error: {
          code: 'FETCH_FAILED',
          message: 'Failed to fetch batch job',
        },
      });
    }
  });

  // 4. Update batch job
  fastify.put('/jobs/:id', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const data = updateBatchJobSchema.parse(request.body);

      // Verify ownership
      const existing = await prisma.batchJob.findFirst({
        where: {
          id,
          userId: request.user.id,
          deletedAt: null,
        },
      });

      if (!existing) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Batch job not found',
          },
        });
      }

      // Can't update a running job's concurrency
      if (existing.status === 'RUNNING' && data.concurrency) {
        return reply.status(400).send({
          error: {
            code: 'INVALID_OPERATION',
            message: 'Cannot change concurrency of a running job',
          },
        });
      }

      const updated = await prisma.batchJob.update({
        where: { id },
        data,
      });

      return reply.send(updated);
    } catch (error) {
      request.log.error(error, 'Failed to update batch job');

      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors,
          },
        });
      }

      return reply.status(500).send({
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update batch job',
        },
      });
    }
  });

  // 5. Delete batch job
  fastify.delete('/jobs/:id', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };

      // Verify ownership
      const existing = await prisma.batchJob.findFirst({
        where: {
          id,
          userId: request.user.id,
          deletedAt: null,
        },
      });

      if (!existing) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Batch job not found',
          },
        });
      }

      // Soft delete
      await prisma.batchJob.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      return reply.status(204).send();
    } catch (error) {
      request.log.error(error, 'Failed to delete batch job');

      return reply.status(500).send({
        error: {
          code: 'DELETE_FAILED',
          message: 'Failed to delete batch job',
        },
      });
    }
  });

  // 6. Start batch job
  fastify.post('/jobs/:id/start', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };

      // Verify ownership
      const existing = await prisma.batchJob.findFirst({
        where: {
          id,
          userId: request.user.id,
          deletedAt: null,
        },
      });

      if (!existing) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Batch job not found',
          },
        });
      }

      // Start the job
      await batchQueue.startBatchJob(id);

      const updated = await prisma.batchJob.findUnique({
        where: { id },
      });

      return reply.send(updated);
    } catch (error) {
      request.log.error(error, 'Failed to start batch job');

      return reply.status(500).send({
        error: {
          code: 'START_FAILED',
          message: error instanceof Error ? error.message : 'Failed to start batch job',
        },
      });
    }
  });

  // 7. Pause batch job
  fastify.post('/jobs/:id/pause', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };

      // Verify ownership
      const existing = await prisma.batchJob.findFirst({
        where: {
          id,
          userId: request.user.id,
          deletedAt: null,
        },
      });

      if (!existing) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Batch job not found',
          },
        });
      }

      await batchQueue.pauseBatchJob(id);

      const updated = await prisma.batchJob.findUnique({
        where: { id },
      });

      return reply.send(updated);
    } catch (error) {
      request.log.error(error, 'Failed to pause batch job');

      return reply.status(500).send({
        error: {
          code: 'PAUSE_FAILED',
          message: error instanceof Error ? error.message : 'Failed to pause batch job',
        },
      });
    }
  });

  // 8. Resume batch job
  fastify.post('/jobs/:id/resume', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };

      // Verify ownership
      const existing = await prisma.batchJob.findFirst({
        where: {
          id,
          userId: request.user.id,
          deletedAt: null,
        },
      });

      if (!existing) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Batch job not found',
          },
        });
      }

      await batchQueue.resumeBatchJob(id);

      const updated = await prisma.batchJob.findUnique({
        where: { id },
      });

      return reply.send(updated);
    } catch (error) {
      request.log.error(error, 'Failed to resume batch job');

      return reply.status(500).send({
        error: {
          code: 'RESUME_FAILED',
          message: error instanceof Error ? error.message : 'Failed to resume batch job',
        },
      });
    }
  });

  // 9. Cancel batch job
  fastify.post('/jobs/:id/cancel', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };

      // Verify ownership
      const existing = await prisma.batchJob.findFirst({
        where: {
          id,
          userId: request.user.id,
          deletedAt: null,
        },
      });

      if (!existing) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Batch job not found',
          },
        });
      }

      await batchQueue.cancelBatchJob(id);

      const updated = await prisma.batchJob.findUnique({
        where: { id },
      });

      return reply.send(updated);
    } catch (error) {
      request.log.error(error, 'Failed to cancel batch job');

      return reply.status(500).send({
        error: {
          code: 'CANCEL_FAILED',
          message: error instanceof Error ? error.message : 'Failed to cancel batch job',
        },
      });
    }
  });

  // 10. Add files to batch
  fastify.post('/jobs/:id/items', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };

      // Verify ownership and that job is in DRAFT status
      const batchJob = await prisma.batchJob.findFirst({
        where: {
          id,
          userId: request.user.id,
          deletedAt: null,
        },
      });

      if (!batchJob) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Batch job not found',
          },
        });
      }

      if (batchJob.status !== 'DRAFT') {
        return reply.status(400).send({
          error: {
            code: 'INVALID_OPERATION',
            message: 'Can only add files to DRAFT batch jobs',
          },
        });
      }

      // Get uploaded files
      const files = await request.files();
      const createdItems = [];

      for await (const file of files) {
        const buffer = await file.toBuffer();

        // Generate unique filename
        const fileExtension = file.filename.split('.').pop() || 'mp3';
        const uniqueFilename = `${request.user.id}/batch-${id}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExtension}`;

        // Upload to Supabase
        await uploadFile(
          AUDIO_BUCKET,
          uniqueFilename,
          buffer,
          file.mimetype
        );

        // Create transcript record
        const transcript = await prisma.transcript.create({
          data: {
            userId: request.user.id,
            title: file.filename,
            language: 'en', // Default, can be customized
            status: 'QUEUED',
            audioUrl: uniqueFilename,
            duration: 0,
          },
        });

        // Create batch item
        const batchItem = await prisma.batchItem.create({
          data: {
            batchJobId: id,
            transcriptId: transcript.id,
            fileName: file.filename,
            fileSize: buffer.length,
            status: 'PENDING',
            progress: 0,
          },
        });

        createdItems.push(batchItem);
      }

      // Update batch job total items count
      await prisma.batchJob.update({
        where: { id },
        data: {
          totalItems: { increment: createdItems.length },
        },
      });

      return reply.send({
        added: createdItems.length,
        items: createdItems,
      });
    } catch (error) {
      request.log.error(error, 'Failed to add files to batch');

      return reply.status(500).send({
        error: {
          code: 'ADD_FILES_FAILED',
          message: 'Failed to add files to batch job',
        },
      });
    }
  });

  // 11. Remove item from batch
  fastify.delete('/jobs/:jobId/items/:itemId', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { jobId, itemId } = request.params as { jobId: string; itemId: string };

      // Verify ownership
      const batchJob = await prisma.batchJob.findFirst({
        where: {
          id: jobId,
          userId: request.user.id,
          deletedAt: null,
        },
      });

      if (!batchJob) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Batch job not found',
          },
        });
      }

      // Can only remove from DRAFT jobs
      if (batchJob.status !== 'DRAFT') {
        return reply.status(400).send({
          error: {
            code: 'INVALID_OPERATION',
            message: 'Can only remove items from DRAFT batch jobs',
          },
        });
      }

      // Find and delete item
      const item = await prisma.batchItem.findFirst({
        where: {
          id: itemId,
          batchJobId: jobId,
        },
      });

      if (!item) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Batch item not found',
          },
        });
      }

      await prisma.batchItem.delete({
        where: { id: itemId },
      });

      // Update batch job total items count
      await prisma.batchJob.update({
        where: { id: jobId },
        data: {
          totalItems: { decrement: 1 },
        },
      });

      return reply.status(204).send();
    } catch (error) {
      request.log.error(error, 'Failed to remove item from batch');

      return reply.status(500).send({
        error: {
          code: 'REMOVE_ITEM_FAILED',
          message: 'Failed to remove item from batch job',
        },
      });
    }
  });

  // 12. Retry failed item
  fastify.post('/jobs/:jobId/items/:itemId/retry', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { jobId, itemId } = request.params as { jobId: string; itemId: string };

      // Verify ownership
      const batchJob = await prisma.batchJob.findFirst({
        where: {
          id: jobId,
          userId: request.user.id,
          deletedAt: null,
        },
      });

      if (!batchJob) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Batch job not found',
          },
        });
      }

      // Verify item exists and belongs to this job
      const item = await prisma.batchItem.findFirst({
        where: {
          id: itemId,
          batchJobId: jobId,
        },
      });

      if (!item) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Batch item not found',
          },
        });
      }

      // Retry the item
      await batchQueue.retryItem(itemId);

      const updated = await prisma.batchItem.findUnique({
        where: { id: itemId },
      });

      return reply.send(updated);
    } catch (error) {
      request.log.error(error, 'Failed to retry batch item');

      return reply.status(500).send({
        error: {
          code: 'RETRY_FAILED',
          message: error instanceof Error ? error.message : 'Failed to retry batch item',
        },
      });
    }
  });
}
