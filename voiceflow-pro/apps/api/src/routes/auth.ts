import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '@voiceflow-pro/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
});

const updatePasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8),
});

export async function authRoutes(fastify: FastifyInstance) {
  // Register
  fastify.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password, name } = registerSchema.parse(request.body);

    try {
      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        },
      });

      if (authError || !authData.user) {
        if (authError?.message?.includes('already registered')) {
          return reply.status(409).send({
            error: {
              code: 'USER_EXISTS',
              message: 'User with this email already exists',
            },
          });
        }
        throw authError || new Error('Failed to create user');
      }

      // Create user in our database
      const user = await prisma.user.create({
        data: {
          id: authData.user.id,
          email,
          name,
          subscriptionTier: 'FREE',
        },
        select: {
          id: true,
          email: true,
          name: true,
          subscriptionTier: true,
          createdAt: true,
        },
      });

      // Get session token
      const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password,
      });

      if (sessionError || !sessionData.session) {
        throw sessionError || new Error('Failed to create session');
      }

      return reply.send({
        user,
        token: sessionData.session.access_token,
        refreshToken: sessionData.session.refresh_token,
      });
    } catch (error) {
      fastify.log.error(error, 'Registration failed');
      return reply.status(500).send({
        error: {
          code: 'REGISTRATION_FAILED',
          message: 'Failed to register user',
        },
      });
    }
  });

  // Login
  fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password } = loginSchema.parse(request.body);

    try {
      // Sign in with Supabase
      const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password,
      });

      if (sessionError || !sessionData.user) {
        return reply.status(401).send({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          },
        });
      }

      // Get user from our database
      let user = await prisma.user.findUnique({
        where: { id: sessionData.user.id },
        select: {
          id: true,
          email: true,
          name: true,
          subscriptionTier: true,
        },
      });

      // Create user if they don't exist (e.g., created through Supabase dashboard)
      if (!user) {
        user = await prisma.user.create({
          data: {
            id: sessionData.user.id,
            email: sessionData.user.email || email,
            name: sessionData.user.user_metadata?.name || 'User',
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

      return reply.send({
        user,
        token: sessionData.session.access_token,
        refreshToken: sessionData.session.refresh_token,
      });
    } catch (error) {
      fastify.log.error(error, 'Login failed');
      return reply.status(500).send({
        error: {
          code: 'LOGIN_FAILED',
          message: 'Failed to login',
        },
      });
    }
  });

  // Get current user
  fastify.get('/me', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    return reply.send({
      user: request.user,
    });
  });

  // Logout (client-side token removal)
  fastify.post('/logout', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    return reply.send({
      message: 'Logged out successfully',
    });
  });

  // Request password reset
  fastify.post('/reset-password', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email } = resetPasswordSchema.parse(request.body);

    try {
      const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/update-password`,
      });

      if (error) {
        throw error;
      }

      return reply.send({
        message: 'Password reset email sent',
      });
    } catch (error) {
      fastify.log.error(error, 'Password reset failed');
      // Don't reveal if email exists or not
      return reply.send({
        message: 'If an account exists with this email, a password reset link has been sent',
      });
    }
  });

  // Update password with reset token
  fastify.post('/update-password', async (request: FastifyRequest, reply: FastifyReply) => {
    const { token, password } = updatePasswordSchema.parse(request.body);

    try {
      const { error } = await supabaseAdmin.auth.updateUser(token, {
        password,
      });

      if (error) {
        return reply.status(400).send({
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired reset token',
          },
        });
      }

      return reply.send({
        message: 'Password updated successfully',
      });
    } catch (error) {
      fastify.log.error(error, 'Password update failed');
      return reply.status(500).send({
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update password',
        },
      });
    }
  });
}