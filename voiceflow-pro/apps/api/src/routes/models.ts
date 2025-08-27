import { FastifyPluginAsync } from 'fastify';
import { pipeline } from 'stream';
import { promisify } from 'util';
import fetch from 'node-fetch';

const streamPipeline = promisify(pipeline);

const modelsRoute: FastifyPluginAsync = async (fastify) => {
  // Download Whisper model with streaming support
  fastify.get('/download/:modelName', {
    schema: {
      params: {
        type: 'object',
        properties: {
          modelName: { 
            type: 'string',
            enum: ['tiny', 'tiny.en', 'base', 'base.en', 'small', 'small.en', 'medium', 'medium.en', 'large-v3']
          }
        },
        required: ['modelName']
      }
    }
  }, async (request, reply) => {
    const { modelName } = request.params as { modelName: string };
    
    try {
      const modelUrl = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${modelName}.bin`;
      
      fastify.log.info(`Proxying model download: ${modelName} from ${modelUrl}`);
      
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
      reply.header('cache-control', 'public, max-age=86400'); // Cache for 24 hours
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
      fastify.log.error(`Model download error for ${modelName}:`, error);
      return reply.status(500).send({
        error: 'Download failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get model information
  fastify.get('/info/:modelName', async (request, reply) => {
    const { modelName } = request.params as { modelName: string };
    
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
    
    const info = modelInfo[modelName as keyof typeof modelInfo];
    if (!info) {
      return reply.status(404).send({ error: 'Model not found' });
    }
    
    reply.send({
      name: modelName,
      ...info,
      url: `/api/models/download/${modelName}`
    });
  });
};

export default modelsRoute;