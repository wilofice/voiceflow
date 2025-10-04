import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';

type AuthenticatedUserRecord = import('../src/routes/auth').AuthenticatedUserRecord;

type AuthModule = typeof import('../src/routes/auth');

let authModule: AuthModule;

beforeAll(async () => {
  process.env.JWT_ACCESS_TOKEN_TTL = '1h';
  process.env.JWT_REFRESH_TOKEN_TTL = '7d';
  authModule = await import('../src/routes/auth');
});

afterAll(async () => {
  delete process.env.JWT_ACCESS_TOKEN_TTL;
  delete process.env.JWT_REFRESH_TOKEN_TTL;
});

describe('auth token utilities', () => {
  it('parses duration strings into seconds', () => {
    const { parseDurationToSeconds } = authModule;
    expect(parseDurationToSeconds('45s', 0)).toBe(45);
    expect(parseDurationToSeconds('2m', 0)).toBe(120);
    expect(parseDurationToSeconds('3h', 0)).toBe(10800);
    expect(parseDurationToSeconds('1d', 0)).toBe(86400);
    expect(parseDurationToSeconds('invalid', 42)).toBe(42);
    expect(parseDurationToSeconds(undefined, 99)).toBe(99);
  });

  it('serializes date fields to ISO strings', () => {
    const { serializeUser } = authModule;
    const createdAt = new Date('2024-01-01T00:00:00.000Z');
    const updatedAt = new Date('2024-01-02T12:30:00.000Z');

    const serialized = serializeUser({
      id: 'user-1',
      email: 'user@example.com',
      name: 'Tester',
      subscriptionTier: 'FREE',
      createdAt,
      updatedAt,
    });

    expect(serialized.createdAt).toBe(createdAt.toISOString());
    expect(serialized.updatedAt).toBe(updatedAt.toISOString());
  });

  it('generates access and refresh tokens with expected payloads', async () => {
    const { generateAuthTokens } = authModule;
    const fastify = Fastify();
    await fastify.register(fastifyJwt, { secret: 'test-secret' });
    await fastify.ready();

    const user: AuthenticatedUserRecord = {
      id: 'user-42',
      email: 'user42@example.com',
      name: 'User 42',
      subscriptionTier: 'FREE',
    };

    const tokens = generateAuthTokens(fastify, user);

    expect(tokens.accessToken).toBeTypeOf('string');
    expect(tokens.refreshToken).toBeTypeOf('string');
    expect(tokens.expiresAt).toBeGreaterThan(Date.now());

    const accessPayload = fastify.jwt.verify(tokens.accessToken) as { sub: string; email?: string; type: string };
    expect(accessPayload.sub).toBe(user.id);
    expect(accessPayload.email).toBe(user.email);
    expect(accessPayload.type).toBe('access');

    const refreshPayload = fastify.jwt.verify(tokens.refreshToken) as { sub: string; type: string };
    expect(refreshPayload.sub).toBe(user.id);
    expect(refreshPayload.type).toBe('refresh');

    await fastify.close();
  });
});
