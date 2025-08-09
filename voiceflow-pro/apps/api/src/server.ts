import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';

// Routes
import { authRoutes } from './routes/auth';
import { transcriptRoutes } from './routes/transcripts';
import { uploadRoutes } from './routes/upload';
import { userRoutes } from './routes/users';

// Middleware
import { errorHandler } from './middleware/errorHandler';
import { authenticate } from './middleware/auth';

// Supabase setup
import { createStorageBucket } from './lib/supabase';

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
    // Register plugins
    await server.register(cors, {
      origin: process.env.NODE_ENV === 'development' 
        ? ['http://localhost:3000'] 
        : [process.env.NEXT_PUBLIC_APP_URL || ''],
      credentials: true,
    });

    await server.register(multipart, {
      limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE || '2147483648'), // 2GB
      },
    });

    await server.register(rateLimit, {
      max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
      timeWindow: process.env.RATE_LIMIT_WINDOW || '15 minutes',
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
    await server.register(uploadRoutes, { prefix: '/api/upload' });
    await server.register(transcriptRoutes, { prefix: '/api/transcripts' });
    await server.register(userRoutes, { prefix: '/api/users' });

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