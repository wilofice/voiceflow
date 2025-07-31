import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '@voiceflow-pro/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
});

export async function userRoutes(fastify: FastifyInstance) {
  // Get user profile
  fastify.get('/profile', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        subscriptionTier: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            transcripts: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });

    if (!user) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    return reply.send({
      user: {
        ...user,
        transcriptCount: user._count.transcripts,
      },
    });
  });

  // Update user profile
  fastify.put('/profile', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const updates = updateProfileSchema.parse(request.body);

    // Check if email is already taken (if updating email)
    if (updates.email && updates.email !== request.user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: updates.email },
      });

      if (existingUser) {
        return reply.status(409).send({
          error: {
            code: 'EMAIL_TAKEN',
            message: 'Email is already in use',
          },
        });
      }
    }

    const user = await prisma.user.update({
      where: { id: request.user.id },
      data: updates,
      select: {
        id: true,
        email: true,
        name: true,
        subscriptionTier: true,
        updatedAt: true,
      },
    });

    return reply.send({
      user,
    });
  });

  // Get user statistics
  fastify.get('/stats', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const [transcriptStats, totalDuration] = await Promise.all([
      prisma.transcript.groupBy({
        by: ['status'],
        where: {
          userId: request.user.id,
          deletedAt: null,
        },
        _count: {
          id: true,
        },
      }),
      prisma.transcript.aggregate({
        where: {
          userId: request.user.id,
          deletedAt: null,
          status: 'COMPLETED',
        },
        _sum: {
          duration: true,
        },
      }),
    ]);

    const stats = transcriptStats.reduce((acc, stat) => {
      acc[stat.status.toLowerCase()] = stat._count.id;
      return acc;
    }, {} as Record<string, number>);

    return reply.send({
      stats: {
        total: Object.values(stats).reduce((sum, count) => sum + count, 0),
        queued: stats.queued || 0,
        processing: stats.processing || 0,
        completed: stats.completed || 0,
        failed: stats.failed || 0,
        totalDuration: totalDuration._sum.duration || 0,
      },
    });
  });

  // Delete user account
  fastify.delete('/account', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    // Soft delete all user's transcripts
    await prisma.transcript.updateMany({
      where: { userId: request.user.id },
      data: { deletedAt: new Date() },
    });

    // Soft delete user
    await prisma.user.update({
      where: { id: request.user.id },
      data: { deletedAt: new Date() },
    });

    return reply.send({
      success: true,
      message: 'Account deleted successfully',
    });
  });
}