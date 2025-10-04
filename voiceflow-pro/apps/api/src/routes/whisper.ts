/**
 * Whisper API Routes
 * Server-side transcription endpoints for local and Docker whisper processing
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { HybridTranscriptionService } from '../services/hybridTranscription';
import { whisperMonitoring } from '../middleware/whisperMonitoring';

// Request schemas
const transcribeSchema = z.object({
  method: z.enum(['auto', 'openai', 'whisper-local', 'whisper-docker']).default('auto'),
  model: z.string().default('base'),
  language: z.string().optional(),
  task: z.enum(['transcribe', 'translate']).default('transcribe'),
  priority: z.enum(['speed', 'accuracy', 'cost', 'privacy', 'balanced']).default('balanced'),
  wordTimestamps: z.boolean().default(false),
  fallbackEnabled: z.boolean().default(true),
});

const localTranscribeSchema = z.object({
  model: z.string().default('base'),
  language: z.string().optional(),
  task: z.enum(['transcribe', 'translate']).default('transcribe'),
  wordTimestamps: z.boolean().default(false),
  threads: z.number().optional(),
});

const dockerTranscribeSchema = z.object({
  model: z.string().default('base'),
  language: z.string().optional(),
  task: z.enum(['transcribe', 'translate']).default('transcribe'),
  wordTimestamps: z.boolean().default(false),
});

// File validation helper
const ALLOWED_MIME_TYPES = [
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav',
  'audio/aac', 'audio/ogg', 'audio/webm', 'audio/flac', 'audio/x-flac',
  'audio/mp4', 'audio/m4a', 'video/mp4', 'video/quicktime'
];

const ALLOWED_EXTENSIONS = /\.(mp3|wav|m4a|aac|ogg|webm|flac|mp4|mov)$/i;

const enableWhisperLocal = process.env.ENABLE_WHISPER_LOCAL !== 'false';
const enableWhisperDocker = process.env.ENABLE_WHISPER_DOCKER !== 'false';

const hybridService = HybridTranscriptionService.getInstance({
  enableWhisperLocal,
  enableWhisperDocker,
});

const whisperLocalService = hybridService.getLocalService();
const whisperDockerService = hybridService.getDockerService();

export async function whisperRoutes(fastify: FastifyInstance) {
  // Add monitoring hooks
  fastify.addHook('onRequest', whisperMonitoring.requestMonitoring());
  fastify.addHook('onResponse', whisperMonitoring.responseMonitoring());
  fastify.setErrorHandler(whisperMonitoring.errorMonitoring());

  /**
   * POST /api/whisper/transcribe
   * Transcribe audio using hybrid service with intelligent routing
   */
  fastify.post('/transcribe', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const file = await request.file();
    
    if (!file) {
      return reply.status(400).send({
        error: 'No audio file provided',
        code: 'MISSING_FILE'
      });
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype) && 
        !file.filename.match(ALLOWED_EXTENSIONS)) {
      return reply.status(400).send({
        error: 'Invalid file type. Please upload an audio file.',
        code: 'INVALID_FILE_TYPE'
      });
    }

    // Save file temporarily
    const tempDir = path.join(os.tmpdir(), 'whisper-uploads');
    await fs.mkdir(tempDir, { recursive: true });
    
    const tempFilePath = path.join(tempDir, `${uuidv4()}-${file.filename}`);
    await fs.writeFile(tempFilePath, await file.toBuffer());

    try {

      // Extract fields from multipart form
      // file.fields is a Map<string, MultipartField[]>
      const fields: Record<string, any> = {};
      if (file.fields) {
        for (const [key, valueArr] of Object.entries(file.fields)) {
          if (Array.isArray(valueArr) && valueArr.length > 0) {
            const field = valueArr[0];
            // Only use .value if it's a text field (not a file)
            if ('value' in field && typeof field.value === 'string') {
              fields[key] = field.value;
            }
          }
        }
      }

      // Convert string booleans/numbers to correct types for Zod
      if (fields.wordTimestamps !== undefined) fields.wordTimestamps = fields.wordTimestamps === 'true';
      if (fields.fallbackEnabled !== undefined) fields.fallbackEnabled = fields.fallbackEnabled === 'true';

      // Parse params using Zod
      const params = transcribeSchema.parse(fields);


      // Accept 'balanced' as a valid priority, but map it to undefined for the backend if not supported
      const mappedPriority = params.priority === 'balanced' ? undefined : params.priority;

      const transcriptionRequest = {
        filePath: tempFilePath,
        method: params.method as any,
        options: {
          model: params.model as any,
          language: params.language,
          task: params.task,
          wordTimestamps: params.wordTimestamps
        },
        priority: mappedPriority,
        fallbackEnabled: params.fallbackEnabled,
        userId: request.user.id,
        metadata: {
          originalName: file.filename,
          mimeType: file.mimetype,
          uploadTime: new Date()
        }
      };

      console.log(`🎙️ Transcription request: ${JSON.stringify({
        method: params.method,
        model: params.model,
        language: params.language,
        fileSize: file.file.bytesRead,
        priority: params.priority
      })}`);

      const result = await hybridService.transcribe(transcriptionRequest);

      return reply.send({
        success: true,
        result: {
          id: result.id,
          text: result.text,
          segments: result.segments,
          language: result.language,
          duration: result.duration,
          processingTime: result.processingTime,
          method: result.method,
          model: result.model,
          cost: result.cost,
          fallbackUsed: result.fallbackUsed,
          metadata: result.metadata
        }
      });

    } catch (error: any) {
      console.error('Transcription error:', error);
      return reply.status(500).send({
        error: error.message || 'Internal server error',
        code: error.code || 'TRANSCRIPTION_FAILED',
        method: error.method || 'unknown'
      });
    } finally {
      // Clean up temp file
      try {
        await fs.unlink(tempFilePath);
      } catch (error) {
        console.warn('Failed to clean up temp file:', error);
      }
    }
  });

  /**
   * POST /api/whisper/transcribe/local
   * Transcribe audio specifically using local Whisper
   */
  fastify.post('/transcribe/local', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!whisperLocalService) {
      return reply.status(503).send({
        error: 'Local Whisper service is not available',
        code: 'SERVICE_UNAVAILABLE'
      });
    }

    const file = await request.file();
    
    if (!file) {
      return reply.status(400).send({
        error: 'No audio file provided',
        code: 'MISSING_FILE'
      });
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype) && 
        !file.filename.match(ALLOWED_EXTENSIONS)) {
      return reply.status(400).send({
        error: 'Invalid file type. Please upload an audio file.',
        code: 'INVALID_FILE_TYPE'
      });
    }

    // Save file temporarily
    const tempDir = path.join(os.tmpdir(), 'whisper-uploads');
    await fs.mkdir(tempDir, { recursive: true });
    
    const tempFilePath = path.join(tempDir, `${uuidv4()}-${file.filename}`);
    await fs.writeFile(tempFilePath, await file.toBuffer());

    try {
      // Extract fields from multipart form
      const fields: Record<string, any> = {};
      if (file.fields) {
        for (const [key, valueArr] of Object.entries(file.fields)) {
          if (Array.isArray(valueArr) && valueArr.length > 0) {
            const field = valueArr[0];
            if ('value' in field && typeof field.value === 'string') {
              fields[key] = field.value;
            }
          }
        }
      }
      // Convert string booleans/numbers to correct types for Zod
      if (fields.wordTimestamps !== undefined) fields.wordTimestamps = fields.wordTimestamps === 'true';
      if (fields.threads !== undefined) fields.threads = Number(fields.threads);

      const params = localTranscribeSchema.parse(fields);

      const result = await whisperLocalService.transcribeFile(tempFilePath, {
        model: params.model as any,
        language: params.language,
        task: params.task,
        wordTimestamps: params.wordTimestamps,
        threads: params.threads
      });

      return reply.send({
        success: true,
        result
      });

    } catch (error: any) {
      console.error('Local transcription error:', error);
      return reply.status(500).send({
        error: error.message || 'Local transcription failed',
        code: 'LOCAL_TRANSCRIPTION_FAILED'
      });
    } finally {
      // Clean up temp file
      try {
        await fs.unlink(tempFilePath);
      } catch (error) {
        console.warn('Failed to clean up temp file:', error);
      }
    }
  });

  /**
   * POST /api/whisper/transcribe/docker
   * Transcribe audio specifically using Docker Whisper
   */
  fastify.post('/transcribe/docker', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!whisperDockerService) {
      return reply.status(503).send({
        error: 'Docker Whisper service is not available',
        code: 'SERVICE_UNAVAILABLE'
      });
    }

    const file = await request.file();
    
    if (!file) {
      return reply.status(400).send({
        error: 'No audio file provided',
        code: 'MISSING_FILE'
      });
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype) && 
        !file.filename.match(ALLOWED_EXTENSIONS)) {
      return reply.status(400).send({
        error: 'Invalid file type. Please upload an audio file.',
        code: 'INVALID_FILE_TYPE'
      });
    }

    // Save file temporarily
    const tempDir = path.join(os.tmpdir(), 'whisper-uploads');
    await fs.mkdir(tempDir, { recursive: true });
    
    const tempFilePath = path.join(tempDir, `${uuidv4()}-${file.filename}`);
    await fs.writeFile(tempFilePath, await file.toBuffer());

    try {
      const params = dockerTranscribeSchema.parse(request.body);

      const result = await whisperDockerService.transcribeFile(tempFilePath, {
        model: params.model as any,
        language: params.language,
        task: params.task,
        wordTimestamps: params.wordTimestamps
      });

      return reply.send({
        success: true,
        result
      });

    } catch (error: any) {
      console.error('Docker transcription error:', error);
      return reply.status(500).send({
        error: error.message || 'Docker transcription failed',
        code: 'DOCKER_TRANSCRIPTION_FAILED'
      });
    } finally {
      // Clean up temp file
      try {
        await fs.unlink(tempFilePath);
      } catch (error) {
        console.warn('Failed to clean up temp file:', error);
      }
    }
  });

  /**
   * GET /api/whisper/health
   * Get health status of all Whisper services
   */
  fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const health = await hybridService.getServiceHealth();
      
      return reply.send({
        success: true,
        health,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('Health check error:', error);
      return reply.status(500).send({
        error: error.message || 'Health check failed',
        code: 'HEALTH_CHECK_FAILED'
      });
    }
  });

  /**
   * GET /api/whisper/models
   * Get available Whisper models
   */
  fastify.get('/models', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const models: any = {
        local: [],
        docker: []
      };

      if (whisperLocalService) {
        try {
          models.local = await whisperLocalService.getAvailableModels();
        } catch (error) {
          console.warn('Failed to get local models:', error);
        }
      }

      if (whisperDockerService) {
        try {
          const dockerHealth = await whisperDockerService.getHealthStatus();
          models.docker = dockerHealth.availableModels.map(name => ({
            name,
            exists: true
          }));
        } catch (error) {
          console.warn('Failed to get docker models:', error);
        }
      }

      return reply.send({
        success: true,
        models
      });

    } catch (error: any) {
      console.error('Models fetch error:', error);
      return reply.status(500).send({
        error: error.message || 'Failed to fetch models',
        code: 'MODELS_FETCH_FAILED'
      });
    }
  });

  /**
   * GET /api/whisper/performance
   * Get performance metrics for all methods
   */
  fastify.get('/performance', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const metrics = hybridService.getPerformanceMetrics();
      
      return reply.send({
        success: true,
        metrics,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('Performance metrics error:', error);
      return reply.status(500).send({
        error: error.message || 'Failed to fetch performance metrics',
        code: 'METRICS_FETCH_FAILED'
      });
    }
  });

  /**
   * GET /api/whisper/jobs/:jobId
   * Get status of a specific transcription job
   */
  fastify.get('/jobs/:jobId', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { jobId } = request.params as { jobId: string };
    
    try {
      let job = null;
      
      // Check local service
      if (whisperLocalService) {
        job = whisperLocalService.getJobStatus(jobId);
      }
      
      // Check docker service if not found
      if (!job && whisperDockerService) {
        job = whisperDockerService.getJobStatus(jobId);
      }
      
      if (!job) {
        return reply.status(404).send({
          error: 'Job not found',
          code: 'JOB_NOT_FOUND',
          jobId
        });
      }
      
      return reply.send({
        success: true,
        job
      });

    } catch (error: any) {
      console.error('Job status error:', error);
      return reply.status(500).send({
        error: error.message || 'Failed to get job status',
        code: 'JOB_STATUS_FAILED'
      });
    }
  });

  /**
   * GET /api/whisper/jobs
   * Get all active jobs
   */
  fastify.get('/jobs', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const jobs: any[] = [];
      
      // Get local jobs
      if (whisperLocalService) {
        jobs.push(...whisperLocalService.getActiveJobs().map(job => ({
          ...job,
          service: 'local'
        })));
      }
      
      // Get docker jobs
      if (whisperDockerService) {
        jobs.push(...whisperDockerService.getActiveJobs().map(job => ({
          ...job,
          service: 'docker'
        })));
      }
      
      return reply.send({
        success: true,
        jobs,
        count: jobs.length
      });

    } catch (error: any) {
      console.error('Jobs fetch error:', error);
      return reply.status(500).send({
        error: error.message || 'Failed to fetch jobs',
        code: 'JOBS_FETCH_FAILED'
      });
    }
  });

  /**
   * DELETE /api/whisper/jobs/:jobId
   * Cancel a transcription job
   */
  fastify.delete('/jobs/:jobId', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { jobId } = request.params as { jobId: string };
    
    try {
      let cancelled = false;
      
      // Try to cancel in local service
      if (whisperLocalService) {
        cancelled = whisperLocalService.cancelJob(jobId);
      }
      
      // Try to cancel in docker service if not found
      if (!cancelled && whisperDockerService) {
        // Docker service doesn't have cancelJob method in our implementation
        // You might want to add this functionality
      }
      
      if (!cancelled) {
        return reply.status(404).send({
          error: 'Job not found or cannot be cancelled',
          code: 'JOB_NOT_FOUND',
          jobId
        });
      }
      
      return reply.send({
        success: true,
        message: 'Job cancelled successfully',
        jobId
      });

    } catch (error: any) {
      console.error('Job cancellation error:', error);
      return reply.status(500).send({
        error: error.message || 'Failed to cancel job',
        code: 'JOB_CANCEL_FAILED'
      });
    }
  });

  /**
   * POST /api/whisper/docker/start
   * Start the Docker Whisper container
   */
  fastify.post('/docker/start', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!whisperDockerService) {
      return reply.status(503).send({
        error: 'Docker Whisper service is not available',
        code: 'SERVICE_UNAVAILABLE'
      });
    }

    try {
      await whisperDockerService.startContainer();
      
      return reply.send({
        success: true,
        message: 'Docker container started successfully'
      });

    } catch (error: any) {
      console.error('Container start error:', error);
      return reply.status(500).send({
        error: error.message || 'Failed to start container',
        code: 'CONTAINER_START_FAILED'
      });
    }
  });

  /**
   * POST /api/whisper/docker/stop
   * Stop the Docker Whisper container
   */
  fastify.post('/docker/stop', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!whisperDockerService) {
      return reply.status(503).send({
        error: 'Docker Whisper service is not available',
        code: 'SERVICE_UNAVAILABLE'
      });
    }

    try {
      await whisperDockerService.stopContainer();
      
      return reply.send({
        success: true,
        message: 'Docker container stopped successfully'
      });

    } catch (error: any) {
      console.error('Container stop error:', error);
      return reply.status(500).send({
        error: error.message || 'Failed to stop container',
        code: 'CONTAINER_STOP_FAILED'
      });
    }
  });

  /**
   * GET /api/whisper/monitoring/overall
   * Get overall monitoring status
   */
  fastify.get('/monitoring/overall', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const overallHealth = whisperMonitoring.getOverallHealth();
      
      return reply.send({
        success: true,
        health: overallHealth,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('Monitoring error:', error);
      return reply.status(500).send({
        error: error.message || 'Failed to get monitoring status',
        code: 'MONITORING_FAILED'
      });
    }
  });

  /**
   * GET /api/whisper/monitoring/alerts
   * Get monitoring alerts
   */
  fastify.get('/monitoring/alerts', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { limit } = request.query as { limit?: string };
    
    try {
      const alerts = whisperMonitoring.getAlerts(limit ? parseInt(limit) : undefined);
      
      return reply.send({
        success: true,
        alerts,
        count: alerts.length,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('Alerts fetch error:', error);
      return reply.status(500).send({
        error: error.message || 'Failed to fetch alerts',
        code: 'ALERTS_FETCH_FAILED'
      });
    }
  });
}