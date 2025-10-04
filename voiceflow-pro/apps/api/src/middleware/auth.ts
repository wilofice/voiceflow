import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@voiceflow-pro/database';

export interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: string;
    email: string;
    name: string;
    subscriptionTier: string;
  };
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing authorization token',
        },
      });
    }

    let payload: { sub: string; email?: string; name?: string; type: 'access' | 'refresh' };
    try {
      payload = await request.jwtVerify<{ sub: string; email?: string; name?: string; type: 'access' | 'refresh' }>();
    } catch (error) {
      request.log.error(error, 'JWT verification failed');
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid token',
        },
      });
    }

    if (payload.type !== 'access') {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid token type',
        },
      });
    }

    // Get user from our database
    let user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        subscriptionTier: true,
      },
    });

    if (!user) {
      if (!payload.email) {
        return reply.status(401).send({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User record missing and email unavailable in token',
          },
        });
      }

      user = await prisma.user.create({
        data: {
          id: payload.sub,
          email: payload.email,
          name: payload.name || 'User',
          subscriptionTier: 'FREE',
        },
        select: {
          id: true,
          email: true,
          name: true,
          subscriptionTier: true,
        },
      });
    }

    (request as AuthenticatedRequest).user = user;
  } catch (error) {
    console.error('Authentication error:', error);
    return reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication failed',
      },
    });
  }
}