import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@voiceflow-pro/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';

const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export function parseDurationToSeconds(value: string | undefined | null, defaultSeconds: number): number {
  if (!value) {
    return defaultSeconds;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return defaultSeconds;
  }

  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  const match = trimmed.match(/^(\d+)([smhd])$/i);
  if (!match) {
    return defaultSeconds;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 's':
      return amount;
    case 'm':
      return amount * 60;
    case 'h':
      return amount * 60 * 60;
    case 'd':
      return amount * 60 * 60 * 24;
    default:
      return defaultSeconds;
  }
}

const ACCESS_TOKEN_TTL_SECONDS = parseDurationToSeconds(
  process.env.JWT_ACCESS_TOKEN_TTL ?? '1h',
  DEFAULT_ACCESS_TOKEN_TTL_SECONDS
);

const REFRESH_TOKEN_TTL_SECONDS = parseDurationToSeconds(
  process.env.JWT_REFRESH_TOKEN_TTL ?? process.env.JWT_EXPIRES_IN ?? '30d',
  DEFAULT_REFRESH_TOKEN_TTL_SECONDS
);

export interface AuthenticatedUserRecord {
  id: string;
  email: string;
  name: string;
  subscriptionTier: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export function serializeUser(user: AuthenticatedUserRecord) {
  return {
    ...user,
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
    updatedAt: user.updatedAt instanceof Date ? user.updatedAt.toISOString() : user.updatedAt,
  };
}

export function generateAuthTokens(fastify: FastifyInstance, user: AuthenticatedUserRecord) {
  const accessToken = fastify.jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      type: 'access',
    },
    {
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    }
  );

  const refreshToken = fastify.jwt.sign(
    {
      sub: user.id,
      type: 'refresh',
    },
    {
      expiresIn: REFRESH_TOKEN_TTL_SECONDS,
    }
  );

  return {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000,
  };
}

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

const refreshTokenSchema = z.object({
  refreshToken: z.string(),
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

      const supabaseUser = authData.user;

      if (!supabaseUser.email_confirmed_at) {
        return reply.status(202).send({
          requiresConfirmation: true,
          message: 'Please check your email to complete registration before signing in.',
          email: supabaseUser.email,
        });
      }

      const userId = supabaseUser.id;

      // Create user in our database
      let user: AuthenticatedUserRecord;
      try {
        user = await prisma.user.create({
          data: {
            id: userId,
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
            updatedAt: true,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          try {
            await supabaseAdmin.auth.admin.deleteUser(userId);
          } catch (cleanupError) {
            fastify.log.error(cleanupError, 'Failed to cleanup Supabase user after duplicate email error');
          }

          return reply.status(409).send({
            error: {
              code: 'USER_EXISTS',
              message: 'User with this email already exists',
            },
          });
        }

        throw error;
      }

      return reply.send({
        user: serializeUser(user),
        tokens: generateAuthTokens(fastify, user),
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
          createdAt: true,
          updatedAt: true,
        },
      }) as AuthenticatedUserRecord | null;

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
            createdAt: true,
            updatedAt: true,
          },
        });
      }

      return reply.send({
        user: serializeUser(user),
        tokens: generateAuthTokens(fastify, user),
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

  fastify.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const { refreshToken } = refreshTokenSchema.parse(request.body);

    try {
      const payload = await fastify.jwt.verify<{ sub: string; type: 'access' | 'refresh' }>(refreshToken);

      if (payload.type !== 'refresh') {
        return reply.status(401).send({
          error: {
            code: 'INVALID_REFRESH_TOKEN',
            message: 'Invalid refresh token',
          },
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          name: true,
          subscriptionTier: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        return reply.status(404).send({
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found for refresh token',
          },
        });
      }

      return reply.send({
        tokens: generateAuthTokens(fastify, user),
      });
    } catch (error) {
      fastify.log.warn(error, 'Refresh token validation failed');
      return reply.status(401).send({
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Invalid refresh token',
        },
      });
    }
  });

  // Get current user
  fastify.get('/me', {
    preHandler: authenticate,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const authenticatedRequest = request as AuthenticatedRequest;
    return reply.send({
      user: authenticatedRequest.user,
    });
  });

  // Logout (client-side token removal)
  fastify.post('/logout', {
    preHandler: authenticate,
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
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
      const { error } = await (supabaseAdmin.auth as any).updateUser(token, {
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