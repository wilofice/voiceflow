import { FastifyPluginAsync } from 'fastify';
import { pipeline } from 'stream';
import { promisify } from 'util';
import fetch from 'node-fetch';

const streamPipeline = promisify(pipeline);

const modelsRoute: FastifyPluginAsync = async (fastify) => {
  // Proxy for downloading transformers.js models from Hugging Face Hub
  fastify.get('/download/*', async (request, reply) => {
    const filePath = (request.params as any)['*'];

    if (!filePath) {
      return reply.status(400).send({ error: 'File path is required' });
    }

    // Construct the Hugging Face Hub URL
    // The file path is expected to be like: Xenova/whisper-base/config.json
    // which needs to be converted to: https://huggingface.co/Xenova/whisper-base/resolve/main/config.json
    const parts = filePath.split('/');
    if (parts.length < 3) {
      return reply.status(400).send({ error: 'Invalid model file path format' });
    }
    const repoId = `${parts[0]}/${parts[1]}`;
    const pathInRepo = parts.slice(2).join('/');
    const modelUrl = `https://huggingface.co/${repoId}/resolve/main/${pathInRepo}`;

    try {
      fastify.log.info(`Proxying model download from: ${modelUrl}`);
      
      const response = await fetch(modelUrl);
      
      if (!response.ok) {
        return reply.status(response.status).send({
          error: 'Model file not found on Hugging Face Hub',
          message: `Failed to fetch ${modelUrl}: ${response.statusText}`
        });
      }
      
      // Set appropriate headers for streaming
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        reply.header('content-length', contentLength);
      }
      
      reply.header('content-type', response.headers.get('content-type') || 'application/octet-stream');
      reply.header('cache-control', 'public, max-age=604800'); // Cache for 1 week
      
      // Stream the response body
      if (response.body) {
        await streamPipeline(response.body, reply.raw);
      } else {
        return reply.status(500).send({ error: 'No response body from Hugging Face Hub' });
      }
      
    } catch (error) {
      fastify.log.error(`Model download proxy error for ${filePath}:`, error);
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