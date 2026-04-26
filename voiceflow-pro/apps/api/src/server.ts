import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyJwt from '@fastify/jwt';
import fastifySocketIO from 'fastify-socket.io';
import { Server, Socket } from 'socket.io';

declare module 'fastify' {
  interface FastifyInstance {
    io: Server;
  }
}

// Routes
import { authRoutes } from './routes/auth';
import { batchRoutes } from './routes/batch';
import { transcriptRoutes } from './routes/transcripts';
import { uploadRoutes } from './routes/upload';
import { userRoutes } from './routes/users';
import { whisperRoutes } from './routes/whisper';
import modelsRoute from './routes/models';

// Middleware
import { errorHandler } from './middleware/errorHandler';

// Supabase setup
import { createStorageBucket } from './lib/supabase';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
const server = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty' }
      : undefined,
  },
});

async function start() {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('Missing JWT_SECRET environment variable');
    }

    await server.register(swagger, {
      openapi: {
        info: {
          title: 'VoiceFlow Pro API',
          version: '1.0.0',
          description: 'REST endpoints for VoiceFlow Pro',
        },
        servers: [{ url: 'http://localhost:3002' }],
        components: {},
      },
    });

    await server.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: false,
      },
      staticCSP: true,
      transformStaticCSP: (header) => header,
    });

    // Register plugins
    await server.register(cors, {
      origin: process.env.NODE_ENV === 'development'
        ? ['http://localhost:3000']
        : [process.env.NEXT_PUBLIC_APP_URL || ''],
      credentials: true,
    });

    await server.register(multipart, {
      limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE || '524288000'), // 500MB default
        files: 10, // Max number of files per request (increased for batch uploads)
      },
    });

    await server.register(rateLimit, {
      max: parseInt(process.env.RATE_LIMIT_MAX || '1000'), // Increased to support 5s dashboard polling
      timeWindow: process.env.RATE_LIMIT_WINDOW || '15 minutes',
    });

    await server.register(fastifyJwt, {
      secret: process.env.JWT_SECRET,
    });

    // Register Socket.IO for real-time updates
    await server.register(fastifySocketIO, {
      cors: {
        origin: process.env.NODE_ENV === 'development'
          ? 'http://localhost:3000'
          : (process.env.NEXT_PUBLIC_APP_URL || ''),
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    // Log Socket.IO connection events
    server.io.on('connection', (socket: Socket) => {
      console.log('✅ WebSocket client connected:', socket.id);

      socket.on('disconnect', () => {
        console.log('❌ WebSocket client disconnected:', socket.id);
      });
    });

    // Initialize Supabase storage bucket
    try {
      await createStorageBucket();
      console.log('✅ Storage bucket initialized');
    } catch (error) {
      console.error('⚠️  Storage bucket initialization failed:', error);
    }

    // Global error handler
    server.setErrorHandler(errorHandler);

    // Health check
    server.get('/health', async () => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });

    // Register routes
    await server.register(authRoutes, { prefix: '/api/auth' });
    await server.register(batchRoutes, { prefix: '/api/batch' });
    await server.register(uploadRoutes, { prefix: '/api/upload' });
    await server.register(transcriptRoutes, { prefix: '/api/transcripts' });
    await server.register(userRoutes, { prefix: '/api/users' });
    await server.register(whisperRoutes, { prefix: '/api/whisper' });
    await server.register(modelsRoute, { prefix: '/api/models' });

    console.log('✅ All routes registered successfully');
    console.log('📍 Batch processing API available at /api/batch');
    console.log('📍 Whisper API available at /api/whisper');
    console.log('📡 WebSocket available at /socket.io');

    // Start server
    const port = parseInt(process.env.PORT || '3002');
    const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

    await server.listen({ port, host });
    console.log(`🚀 Server running on http://${host}:${port}`);
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('⏰ Received SIGINT, shutting down gracefully...');
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('⏰ Received SIGTERM, shutting down gracefully...');
  await server.close();
  process.exit(0);
});

start();