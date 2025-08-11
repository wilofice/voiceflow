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

      // Upload to Supabase Storage
      await uploadFile(
        AUDIO_BUCKET,
        uniqueFilename,
        buffer,
        mimetype
      );

      // Get signed URL for the file (valid for 1 hour)
      const signedUrl = await getSignedUrl(AUDIO_BUCKET, uniqueFilename, 3600);

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

    } catch (error) {
      request.log.error(error, 'File upload failed');
      
      return reply.status(500).send({
        error: {
          code: 'UPLOAD_FAILED',
          message: 'Failed to process file upload',
        },
      });
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