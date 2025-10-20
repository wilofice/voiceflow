import { TranscriptStatus } from '@voiceflow-pro/database';
import { prisma } from '@voiceflow-pro/database';
import { getSignedUrl, AUDIO_BUCKET } from '../lib/supabase';
// (Readable removed - not used after refactor)
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { HybridTranscriptionService } from './hybridTranscription';

// Progress callback type
type ProgressCallback = (progress: {
  transcriptId: string;
  progress: number;
  status: TranscriptStatus;
  message?: string;
}) => void;

export class TranscriptionService {
  // Maximum file size for Whisper API (25MB)
  private static readonly MAX_FILE_SIZE = 25 * 1024 * 1024;
  
  // Supported audio formats
  private static readonly SUPPORTED_FORMATS = [
    'mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm', 'ogg', 'opus', 'flac'
  ];

  /**
   * Transcribe an audio file using OpenAI Whisper API
   */
  static async transcribeFile(
    transcriptId: string,
    audioBuffer: Buffer,
    fileName: string,
    options: {
      language?: string;
      prompt?: string;
      onProgress?: ProgressCallback;
    } = {}
  ) {
  const { language, onProgress } = options;

    try {
      // Update status to processing
      await this.updateTranscriptStatus(transcriptId, 'PROCESSING', onProgress);

      // Validate file format
      const fileExtension = fileName.split('.').pop()?.toLowerCase();
      if (!fileExtension || !this.SUPPORTED_FORMATS.includes(fileExtension)) {
        throw new Error(`Unsupported file format: ${fileExtension}`);
      }

      // Check file size
      if (audioBuffer.length > this.MAX_FILE_SIZE) {
        // For large files, we'd implement chunking here
        throw new Error('File too large. Maximum size is 25MB');
      }

      // Write buffer to a temporary file for hybrid/local transcription services
      const tmpDir = os.tmpdir();
      const tempFileName = `transcription-${transcriptId}-${Date.now()}.${fileExtension}`;
      const tempFilePath = path.join(tmpDir, tempFileName);

      await fs.writeFile(tempFilePath, audioBuffer);

      try {
        // Build hybrid request; let HybridTranscriptionService choose local first
        const hybrid = HybridTranscriptionService.getInstance();

        const hybridResult = await hybrid.transcribe({
          filePath: tempFilePath,
          method: 'auto',
          options: {
            model: undefined,
            language: language,
            task: 'transcribe',
          },
          priority: 'privacy', // prefer local by default; hybrid will adjust
          fallbackEnabled: true,
          userId: undefined,
        });

        // Write full hybridResult to a telemetry file for offline inspection
        try {
          const telemetryFileName = `hybridResult-${transcriptId}-${Date.now()}.json`;
          const telemetryFilePath = path.join(tmpDir, telemetryFileName);
          await fs.writeFile(telemetryFilePath, JSON.stringify({ hybridResult }, null, 2));
          console.info(`[transcription] hybridResult telemetry written to ${telemetryFilePath}`);
          // attach telemetry path to the hybridResult for callers/tests
          (hybridResult as any).__telemetryPath = telemetryFilePath;
        } catch (e: any) {
          console.warn('[transcription] failed to write hybridResult telemetry', e?.message || e);
        }
        // Process and save segments (hybridResult should contain segments/text/duration)
        const createdSegments = await this.processTranscriptionResponse(transcriptId, {
          segments: hybridResult.segments || [],
          text: hybridResult.text || '',
          language: hybridResult.language || language,
          duration: hybridResult.duration || 0,
        });

        // Prefer hybridResult.duration, otherwise derive from DB-created segments
        const duration = hybridResult.duration || (createdSegments.length > 0 ? Math.ceil(createdSegments[createdSegments.length - 1].endTime) : 0);

        // Update transcript with completed status
        await prisma.transcript.update({
          where: { id: transcriptId },
          data: {
            status: 'COMPLETED',
            duration,
            language: hybridResult.language || language || 'en',
          },
        });

        // Final progress update
        onProgress?.({
          transcriptId,
          progress: 100,
          status: 'COMPLETED',
          message: 'Transcription completed successfully',
        });

        return {
         transcriptId,
         segments: createdSegments,
          language: hybridResult.language,
          duration,
          text: hybridResult.text,
          resourceUsage: hybridResult.metadata?.resourceUsage,
          model: hybridResult.model,
        };
      } finally {
        // Clean up temp file
        try {
          await fs.unlink(tempFilePath);
        } catch (e) {
          // Ignore cleanup errors
        }
      }

    } catch (error: any) {
      console.error('Transcription error:', error);
      
      // Update transcript status to failed
      await prisma.transcript.update({
        where: { id: transcriptId },
        data: { status: 'FAILED' },
      });

      onProgress?.({
        transcriptId,
        progress: 0,
        status: 'FAILED',
        message: error.message || 'Transcription failed',
      });

      throw error;
    }
  }

  /**
   * Process the transcription response and save segments
   */
  private static async processTranscriptionResponse(
    transcriptId: string,
    response: any
  ) {
    const incoming = response.segments || [];

    console.debug(`[transcription] processTranscriptionResponse: received ${incoming.length} segments for transcript ${transcriptId}`);
    if (incoming.length > 0) {
      // Log a small sample for debugging
      console.debug(`[transcription] sample segment:`, JSON.stringify(incoming[0]).slice(0, 1000));
    }

    // Delete existing segments if any (for retries)
    await prisma.transcriptSegment.deleteMany({
      where: { transcriptId },
    });

    // Normalize incoming segments to expected shape and filter invalid entries
    const segments = incoming.map((seg: any, index: number) => {
      const start = seg.start ?? seg.startTime ?? seg.t0 ?? seg.begin ?? seg.begin_time ?? seg.start_ms ?? 0;
      const end = seg.end ?? seg.endTime ?? seg.t1 ?? seg.finish ?? seg.end_ms ?? seg.duration ?? start;
      const text = seg.text ?? seg.content ?? seg.transcript ?? '';
      const confidence = seg.confidence ?? seg.conf ?? seg.avg_confidence ?? 0.9;

      return {
        start: Number(start) || 0,
        end: Number(end) || 0,
        text: String(text || ''),
        confidence: Number(confidence) || 0.9,
        index,
      };
    }).filter((s: any) => typeof s.start === 'number' && typeof s.end === 'number');

    if (segments.length === 0) {
      console.warn(`[transcription] no normalized segments available for transcript ${transcriptId}`);
    }

    const createdSegments: any[] = [];

    for (const seg of segments) {
      try {
        const created = await prisma.transcriptSegment.create({
          data: {
            transcriptId,
            startTime: seg.start,
            endTime: seg.end,
            text: seg.text,
            speakerId: `SPEAKER_${(seg.index % 3) + 1}`,
            confidence: seg.confidence,
          },
        });
        createdSegments.push(created);
      } catch (err: any) {
        console.error(`[transcription] Failed to create segment for transcript ${transcriptId}:`, err?.message || err);
        // continue with next segment
      }
    }

    console.debug(`[transcription] created ${createdSegments.length} segments for transcript ${transcriptId}`);

    return createdSegments;
  }

  /**
   * Update transcript status and notify progress
   */
  private static async updateTranscriptStatus(
    transcriptId: string,
    status: TranscriptStatus,
    onProgress?: ProgressCallback
  ) {
    await prisma.transcript.update({
      where: { id: transcriptId },
      data: { status },
    });

    onProgress?.({
      transcriptId,
      progress: status === 'PROCESSING' ? 10 : 0,
      status,
    });
  }

  /**
   * Get transcription cost estimate
   */
  static estimateCost(durationInSeconds: number): number {
    // OpenAI Whisper pricing: $0.006 per minute
    const minutes = Math.ceil(durationInSeconds / 60);
    return minutes * 0.006;
  }

  /**
   * Validate audio file before transcription
   */
  static validateAudioFile(
    _buffer: Buffer,
    fileName: string
  ): { valid: boolean; error?: string } {
    // Check file extension
    const fileExtension = fileName.split('.').pop()?.toLowerCase();
    if (!fileExtension || !this.SUPPORTED_FORMATS.includes(fileExtension)) {
      return {
        valid: false,
        error: `Unsupported file format. Supported formats: ${this.SUPPORTED_FORMATS.join(', ')}`,
      };
    }

    // Check file size
    if (_buffer.length > this.MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File too large. Maximum size is ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`,
      };
    }

    // Check if buffer is not empty
    if (_buffer.length === 0) {
      return {
        valid: false,
        error: 'File is empty',
      };
    }

    return { valid: true };
  }

  /**
   * Extract audio metadata (placeholder for future implementation)
   */
  static async extractMetadata(_buffer: Buffer): Promise<{
    duration?: number;
    bitrate?: number;
    sampleRate?: number;
    channels?: number;
  }> {
    // TODO: Implement audio metadata extraction using ffprobe or similar
    return {};
  }

  /**
   * Retry failed transcription
   */
  static async retryTranscription(transcriptId: string) {
    const transcript = await prisma.transcript.findUnique({
      where: { id: transcriptId },
    });

    if (!transcript || transcript.status !== 'FAILED') {
      throw new Error('Transcript not found or not in failed state');
    }

    // Reset status to queued
    await prisma.transcript.update({
      where: { id: transcriptId },
      data: { status: 'QUEUED' },
    });

    // Get the audio file from storage
    await getSignedUrl(AUDIO_BUCKET, transcript.audioUrl!, 3600);
    
    // TODO: Re-download the file and process it
    // This would be handled by a queue system in production
    
    return { message: 'Transcription retry queued' };
  }
}