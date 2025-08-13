/**
 * Whisper API Routes
 * Server-side transcription endpoints for local and Docker whisper processing
 */

import { Request, Response } from 'express';
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';
import { HybridTranscriptionService } from '../services/hybridTranscription';
import { WhisperServerService } from '../services/whisperServer';
import { WhisperDockerService } from '../services/whisperDocker';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  dest: path.join(os.tmpdir(), 'whisper-uploads'),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    const allowedMimeTypes = [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav',
      'audio/aac', 'audio/ogg', 'audio/webm', 'audio/flac', 'audio/x-flac',
      'audio/mp4', 'audio/m4a', 'video/mp4', 'video/quicktime'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype) || 
        file.originalname.match(/\.(mp3|wav|m4a|aac|ogg|webm|flac|mp4|mov)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Please upload an audio file.'));
    }
  }
});

// Initialize services
const hybridService = HybridTranscriptionService.getInstance();
let whisperLocalService: WhisperServerService | null = null;
let whisperDockerService: WhisperDockerService | null = null;

// Initialize services based on environment
try {
  if (process.env.ENABLE_WHISPER_LOCAL !== 'false') {
    whisperLocalService = new WhisperServerService();
  }
} catch (error) {
  console.warn('Local Whisper service not available:', error);
}

try {
  if (process.env.ENABLE_WHISPER_DOCKER !== 'false') {
    whisperDockerService = new WhisperDockerService();
  }
} catch (error) {
  console.warn('Docker Whisper service not available:', error);
}

/**
 * POST /api/whisper/transcribe
 * Transcribe audio using hybrid service with intelligent routing
 */
router.post('/transcribe', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No audio file provided',
        code: 'MISSING_FILE'
      });
    }

    const {
      method = 'auto',
      model = 'base',
      language,
      task = 'transcribe',
      priority = 'balanced',
      wordTimestamps = false,
      fallbackEnabled = true
    } = req.body;

    // Validate method
    const validMethods = ['auto', 'openai', 'whisper-local', 'whisper-docker'];
    if (!validMethods.includes(method)) {
      return res.status(400).json({
        error: `Invalid method. Must be one of: ${validMethods.join(', ')}`,
        code: 'INVALID_METHOD'
      });
    }

    const transcriptionRequest = {
      filePath: req.file.path,
      method: method as any,
      options: {
        model,
        language,
        task,
        wordTimestamps: wordTimestamps === 'true' || wordTimestamps === true
      },
      priority,
      fallbackEnabled: fallbackEnabled === 'true' || fallbackEnabled === true,
      userId: req.user?.id, // Assuming auth middleware sets req.user
      metadata: {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        uploadTime: new Date()
      }
    };

    console.log(`🎙️ Transcription request: ${JSON.stringify({
      method,
      model,
      language,
      fileSize: req.file.size,
      priority
    })}`);

    const result = await hybridService.transcribe(transcriptionRequest);

    // Clean up uploaded file
    try {
      await fs.unlink(req.file.path);
    } catch (error) {
      console.warn('Failed to clean up uploaded file:', error);
    }

    res.json({
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
    // Clean up uploaded file on error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.warn('Failed to clean up uploaded file after error:', cleanupError);
      }
    }

    console.error('Transcription error:', error);

    res.status(500).json({
      error: error.message || 'Internal server error',
      code: error.code || 'TRANSCRIPTION_FAILED',
      method: error.method || 'unknown'
    });
  }
});

/**
 * POST /api/whisper/transcribe/local
 * Transcribe audio specifically using local Whisper
 */
router.post('/transcribe/local', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!whisperLocalService) {
      return res.status(503).json({
        error: 'Local Whisper service is not available',
        code: 'SERVICE_UNAVAILABLE'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'No audio file provided',
        code: 'MISSING_FILE'
      });
    }

    const {
      model = 'base',
      language,
      task = 'transcribe',
      wordTimestamps = false,
      threads
    } = req.body;

    const result = await whisperLocalService.transcribeFile(req.file.path, {
      model,
      language,
      task,
      wordTimestamps: wordTimestamps === 'true' || wordTimestamps === true,
      threads: threads ? parseInt(threads) : undefined
    });

    // Clean up uploaded file
    await fs.unlink(req.file.path);

    res.json({
      success: true,
      result
    });

  } catch (error: any) {
    // Clean up uploaded file on error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.warn('Failed to clean up uploaded file:', cleanupError);
      }
    }

    console.error('Local transcription error:', error);
    res.status(500).json({
      error: error.message || 'Local transcription failed',
      code: 'LOCAL_TRANSCRIPTION_FAILED'
    });
  }
});

/**
 * POST /api/whisper/transcribe/docker
 * Transcribe audio specifically using Docker Whisper
 */
router.post('/transcribe/docker', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!whisperDockerService) {
      return res.status(503).json({
        error: 'Docker Whisper service is not available',
        code: 'SERVICE_UNAVAILABLE'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'No audio file provided',
        code: 'MISSING_FILE'
      });
    }

    const {
      model = 'base',
      language,
      task = 'transcribe',
      wordTimestamps = false
    } = req.body;

    const result = await whisperDockerService.transcribeFile(req.file.path, {
      model,
      language,
      task,
      wordTimestamps: wordTimestamps === 'true' || wordTimestamps === true
    });

    // Clean up uploaded file
    await fs.unlink(req.file.path);

    res.json({
      success: true,
      result
    });

  } catch (error: any) {
    // Clean up uploaded file on error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.warn('Failed to clean up uploaded file:', cleanupError);
      }
    }

    console.error('Docker transcription error:', error);
    res.status(500).json({
      error: error.message || 'Docker transcription failed',
      code: 'DOCKER_TRANSCRIPTION_FAILED'
    });
  }
});

/**
 * GET /api/whisper/health
 * Get health status of all Whisper services
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await hybridService.getServiceHealth();
    
    res.json({
      success: true,
      health,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Health check error:', error);
    res.status(500).json({
      error: error.message || 'Health check failed',
      code: 'HEALTH_CHECK_FAILED'
    });
  }
});

/**
 * GET /api/whisper/models
 * Get available Whisper models
 */
router.get('/models', async (req: Request, res: Response) => {
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

    res.json({
      success: true,
      models
    });

  } catch (error: any) {
    console.error('Models fetch error:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch models',
      code: 'MODELS_FETCH_FAILED'
    });
  }
});

/**
 * GET /api/whisper/performance
 * Get performance metrics for all methods
 */
router.get('/performance', async (req: Request, res: Response) => {
  try {
    const metrics = hybridService.getPerformanceMetrics();
    
    res.json({
      success: true,
      metrics,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Performance metrics error:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch performance metrics',
      code: 'METRICS_FETCH_FAILED'
    });
  }
});

/**
 * GET /api/whisper/jobs/:jobId
 * Get status of a specific transcription job
 */
router.get('/jobs/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    
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
      return res.status(404).json({
        error: 'Job not found',
        code: 'JOB_NOT_FOUND',
        jobId
      });
    }
    
    res.json({
      success: true,
      job
    });

  } catch (error: any) {
    console.error('Job status error:', error);
    res.status(500).json({
      error: error.message || 'Failed to get job status',
      code: 'JOB_STATUS_FAILED'
    });
  }
});

/**
 * GET /api/whisper/jobs
 * Get all active jobs
 */
router.get('/jobs', async (req: Request, res: Response) => {
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
    
    res.json({
      success: true,
      jobs,
      count: jobs.length
    });

  } catch (error: any) {
    console.error('Jobs fetch error:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch jobs',
      code: 'JOBS_FETCH_FAILED'
    });
  }
});

/**
 * DELETE /api/whisper/jobs/:jobId
 * Cancel a transcription job
 */
router.delete('/jobs/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    
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
      return res.status(404).json({
        error: 'Job not found or cannot be cancelled',
        code: 'JOB_NOT_FOUND',
        jobId
      });
    }
    
    res.json({
      success: true,
      message: 'Job cancelled successfully',
      jobId
    });

  } catch (error: any) {
    console.error('Job cancellation error:', error);
    res.status(500).json({
      error: error.message || 'Failed to cancel job',
      code: 'JOB_CANCEL_FAILED'
    });
  }
});

/**
 * POST /api/whisper/docker/start
 * Start the Docker Whisper container
 */
router.post('/docker/start', async (req: Request, res: Response) => {
  try {
    if (!whisperDockerService) {
      return res.status(503).json({
        error: 'Docker Whisper service is not available',
        code: 'SERVICE_UNAVAILABLE'
      });
    }

    await whisperDockerService.startContainer();
    
    res.json({
      success: true,
      message: 'Docker container started successfully'
    });

  } catch (error: any) {
    console.error('Container start error:', error);
    res.status(500).json({
      error: error.message || 'Failed to start container',
      code: 'CONTAINER_START_FAILED'
    });
  }
});

/**
 * POST /api/whisper/docker/stop
 * Stop the Docker Whisper container
 */
router.post('/docker/stop', async (req: Request, res: Response) => {
  try {
    if (!whisperDockerService) {
      return res.status(503).json({
        error: 'Docker Whisper service is not available',
        code: 'SERVICE_UNAVAILABLE'
      });
    }

    await whisperDockerService.stopContainer();
    
    res.json({
      success: true,
      message: 'Docker container stopped successfully'
    });

  } catch (error: any) {
    console.error('Container stop error:', error);
    res.status(500).json({
      error: error.message || 'Failed to stop container',
      code: 'CONTAINER_STOP_FAILED'
    });
  }
});

// Error handling middleware for multer
router.use((error: any, req: Request, res: Response, next: any) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large. Maximum size is 500MB.',
        code: 'FILE_TOO_LARGE'
      });
    }
    
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files. Please upload only one file.',
        code: 'TOO_MANY_FILES'
      });
    }
  }
  
  if (error.message === 'Invalid file type. Please upload an audio file.') {
    return res.status(400).json({
      error: error.message,
      code: 'INVALID_FILE_TYPE'
    });
  }
  
  next(error);
});

export default router;