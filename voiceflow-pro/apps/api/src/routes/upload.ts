import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '@voiceflow-pro/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { uploadFile, getSignedUrl, AUDIO_BUCKET } from '../lib/supabase';
import { TranscriptionService } from '../services/transcription';
import { transcriptionQueue } from '../services/queue';

const ALLOWED_MIME_TYPES = [
  'audio/mpeg',
  'audio/wav',
  'audio/mp4',
  'audio/ogg',
  'audio/opus',
  'video/quicktime',
  'video/mp4',
];

const uploadMetadataSchema = z.object({
  title: z.string().optional(),
  language: z.string().default('en'),
});

export async function uploadRoutes(fastify: FastifyInstance) {
  // Debug route to check env
  fastify.get('/debug', async () => ({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    bucket: AUDIO_BUCKET
  }));

  // Upload audio file
  fastify.post('/audio', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const data = await request.file();

    if (!data) {
      return reply.status(400).send({
        error: {
          code: 'NO_FILE',
          message: 'No file provided',
        },
      });
    }

    const { filename, mimetype } = data;

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_FILE_TYPE',
          message: 'File type not supported',
          details: { supportedTypes: ALLOWED_MIME_TYPES },
        },
      });
    }

    // Get file buffer
    const buffer = await data.toBuffer();

    // Validate file size
    const maxSize = parseInt(process.env.MAX_FILE_SIZE || '2147483648'); // 2GB
    if (buffer.length > maxSize) {
      return reply.status(400).send({
        error: {
          code: 'FILE_TOO_LARGE',
          message: 'File size exceeds maximum allowed size',
          details: { maxSize, actualSize: buffer.length },
        },
      });
    }

    try {
      // Parse additional metadata from fields
      const fields = data.fields;
      const titleField = Array.isArray(fields.title) ? fields.title[0] : fields.title;
      const languageField = Array.isArray(fields.language) ? fields.language[0] : fields.language;

      const metadata = uploadMetadataSchema.parse({
        title: titleField && 'value' in titleField ? titleField.value : undefined,
        language: languageField && 'value' in languageField ? languageField.value : 'en',
      });

      // Generate a unique filename with user folder
      const fileExtension = filename?.split('.').pop() || 'mp3';
      const uniqueFilename = `${request.user.id}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExtension}`;

      // Convert chunked Fastify Buffer to a clean contiguous ArrayBuffer to prevent Node.js fetch 0-byte corruptions
      request.log.info(`[TRACE] Buffer length from Fastify: ${buffer.length} bytes`);
      const cleanArrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

      // Upload to Supabase Storage
      request.log.info(`[TRACE] Starting uploadFile for ${uniqueFilename}...`);
      try {
        await uploadFile(
          AUDIO_BUCKET,
          uniqueFilename,
          cleanArrayBuffer as any,
          mimetype
        );
      } catch (uploadErr: any) {
        throw new Error(`uploadFile failed: ${uploadErr.message || uploadErr}`);
      }
      request.log.info(`[TRACE] SUCCESS: uploadFile finished`);

      // Skip getSignedUrl during the immediate upload phase to prevent 404 read-after-write Node fetch bugs
      // The frontend will receive the signed URL later when querying the transcript natively.
      const signedUrl = null;

      // Create transcript record
      const transcript = await prisma.transcript.create({
        data: {
          userId: request.user.id,
          title: metadata.title || filename || 'Untitled',
          language: metadata.language,
          status: 'QUEUED',
          audioUrl: uniqueFilename, // Store the path, not the full URL
          duration: 0, // Will be updated after processing
        },
        select: {
          id: true,
          title: true,
          status: true,
          audioUrl: true,
          createdAt: true,
        },
      });

      // Validate audio file for transcription
      const validation = TranscriptionService.validateAudioFile(buffer, filename || 'audio');
      if (!validation.valid) {
        // Still allow upload but warn about transcription
        request.log.warn(`Audio validation warning: ${validation.error}`);
      }

      // Queue for transcription processing
      await transcriptionQueue.addJob(transcript.id, uniqueFilename);

      return reply.send({
        uploadId: transcript.id,
        fileName: filename,
        fileSize: buffer.length,
        status: 'QUEUED',
        transcriptId: transcript.id,
        audioUrl: signedUrl,
        validationWarning: validation.error,
      });

    } catch (error: any) {
      request.log.error(error, 'File upload failed');

      return reply.status(500).send({
        error: {
          code: 'UPLOAD_FAILED',
          message: 'Failed to process file upload',
          details: error.message,
          stack: error.stack
        },
      });
    }
  });

  // Fast tracking local audio (Offline Electron Mode) to prevent redundant DB Supabase uploads
  fastify.post('/local-audio', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { fileName, path: absolutePath, metadata } = request.body as any;

      const transcript = await prisma.transcript.create({
        data: {
          userId: request.user.id,
          title: metadata?.title || fileName || 'Untitled',
          language: metadata?.language || 'en',
          status: 'QUEUED',
          audioUrl: absolutePath,
          duration: 0,
        },
        select: {
          id: true,
          title: true,
          status: true,
          audioUrl: true,
          createdAt: true,
        },
      });

      // Still place it in Backend Queue for localized running.
      await transcriptionQueue.addJob(transcript.id, absolutePath);

      return reply.send({
        uploadId: transcript.id,
        fileName,
        fileSize: 0,
        status: 'QUEUED',
        transcriptId: transcript.id,
        audioUrl: null,
      });
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to inject local file' });
    }
  });

  // Fast tracking local audio (Offline Electron Mode) to prevent redundant DB Supabase uploads
  fastify.post('/local-audio', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const { fileName, path: absolutePath, metadata } = request.body as any;

      const transcript = await prisma.transcript.create({
        data: {
          userId: request.user.id,
          title: metadata?.title || fileName || 'Untitled',
          language: metadata?.language || 'en',
          status: 'QUEUED',
          audioUrl: absolutePath,
          duration: 0,
        },
        select: { id: true, title: true, status: true, audioUrl: true, createdAt: true },
      });

      // Place it in Backend Queue for localized running.
      await transcriptionQueue.addJob(transcript.id, absolutePath);

      return reply.send({
        uploadId: transcript.id,
        fileName,
        fileSize: 0,
        status: 'QUEUED',
        transcriptId: transcript.id,
        audioUrl: null,
      });
    } catch (error: any) {
      return reply.status(500).send({ error: 'Failed to inject local file' });
    }
  });

  // Get upload status
  fastify.get('/status/:uploadId', {
    preHandler: authenticate,
  }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const { uploadId } = request.params as { uploadId: string };

    const transcript = await prisma.transcript.findFirst({
      where: {
        id: uploadId,
        userId: request.user.id,
      },
      select: {
        id: true,
        title: true,
        status: true,
        duration: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!transcript) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'Upload not found',
        },
      });
    }

    return reply.send({
      uploadId: transcript.id,
      status: transcript.status,
      duration: transcript.duration,
      createdAt: transcript.createdAt,
      updatedAt: transcript.updatedAt,
    });
  });
}