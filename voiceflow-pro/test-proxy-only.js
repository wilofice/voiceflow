#!/usr/bin/env node

// Simple test server to test CORS proxy without Supabase dependencies
const Fastify = require('fastify');
const cors = require('@fastify/cors');
const fetch = require('node-fetch');
const { pipeline } = require('stream');
const { promisify } = require('util');

const streamPipeline = promisify(pipeline);

const server = Fastify({ logger: true });

async function start() {
  // Register CORS
  await server.register(cors, {
    origin: ['http://localhost:3000', 'file://', '*'],
    credentials: true,
  });

  // Model proxy route (copied from models.ts)
  server.get('/api/models/download/:modelName', async (request, reply) => {
    const { modelName } = request.params;
  
    const validModels = ['tiny', 'tiny.en', 'base', 'base.en', 'small', 'small.en', 'medium', 'medium.en', 'large-v3'];
    if (!validModels.includes(modelName)) {
      return reply.status(400).send({ error: 'Invalid model name' });
    }
    
    try {
      const modelUrl = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${modelName}.bin`;
      
      server.log.info(`Proxying model download: ${modelName} from ${modelUrl}`);
      
      const response = await fetch(modelUrl);
      
      if (!response.ok) {
        return reply.status(404).send({
          error: 'Model not found',
          message: `Failed to fetch model ${modelName}: ${response.statusText}`
        });
      }
      
      // Set appropriate headers
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        reply.header('content-length', contentLength);
      }
      
      reply.header('content-type', 'application/octet-stream');
      reply.header('cache-control', 'public, max-age=86400');
      reply.header('access-control-allow-origin', '*');
      reply.header('access-control-allow-methods', 'GET');
      reply.header('access-control-allow-headers', 'Content-Type');
      
      // Stream the response
      if (response.body) {
        await streamPipeline(response.body, reply.raw);
      } else {
        return reply.status(500).send({ error: 'No response body' });
      }
      
    } catch (error) {
      server.log.error(`Model download error for ${modelName}:`, error);
      return reply.status(500).send({
        error: 'Download failed',
        message: error.message
      });
    }
  });

  // Model info route
  server.get('/api/models/info/:modelName', async (request, reply) => {
    const { modelName } = request.params;
    
    const modelInfo = {
      'tiny': { size: 39321600, accuracy: '~85%', speed: '~32x realtime' },
      'tiny.en': { size: 39321600, accuracy: '~87%', speed: '~32x realtime' },
      'base': { size: 148897600, accuracy: '~91%', speed: '~16x realtime' },
      'base.en': { size: 148897600, accuracy: '~93%', speed: '~16x realtime' },
      'small': { size: 488380800, accuracy: '~94%', speed: '~6x realtime' },
      'small.en': { size: 488380800, accuracy: '~95%', speed: '~6x realtime' },
      'medium': { size: 1611661312, accuracy: '~96%', speed: '~2x realtime' },
      'medium.en': { size: 1611661312, accuracy: '~97%', speed: '~2x realtime' },
      'large-v3': { size: 3321675776, accuracy: '~98%', speed: '~1x realtime' }
    };
    
    const info = modelInfo[modelName];
    if (!info) {
      return reply.status(404).send({ error: 'Model not found' });
    }
    
    reply.send({
      name: modelName,
      ...info,
      url: `/api/models/download/${modelName}`
    });
  });

  // Health check
  server.get('/health', async () => {
    return { status: 'ok', message: 'CORS proxy test server' };
  });

  // Start server
  try {
    await server.listen({ port: 3002, host: 'localhost' });
    console.log('🚀 Test server running on http://localhost:3002');
    console.log('📍 Model proxy available at /api/models/download/:modelName');
    console.log('ℹ️  Model info available at /api/models/info/:modelName');
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }
}

start();