import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@voiceflow-pro/database';
import { verifySupabaseToken } from '../lib/supabase';

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

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Verify with Supabase
    const supabaseUser = await verifySupabaseToken(token);
    if (!supabaseUser) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid token',
        },
      });
    }
    
    // Get user from our database
    const user = await prisma.user.findUnique({
      where: { id: supabaseUser.id },
      select: {
        id: true,
        email: true,
        name: true,
        subscriptionTier: true,
      },
    });

    if (!user) {
      // Create user if they don't exist in our DB yet
      const newUser = await prisma.user.create({
        data: {
          id: supabaseUser.id,
          email: supabaseUser.email || '',
          name: supabaseUser.user_metadata?.name || 'User',
          subscriptionTier: 'FREE',
        },
        select: {
          id: true,
          email: true,
          name: true,
          subscriptionTier: true,
        },
      });
      
      (request as AuthenticatedRequest).user = newUser;
    } else {
      (request as AuthenticatedRequest).user = user;
    }
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