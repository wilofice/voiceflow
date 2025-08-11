import OpenAI from 'openai';
import { TranscriptStatus } from '@voiceflow-pro/database';
import { prisma } from '@voiceflow-pro/database';
import { getSignedUrl, AUDIO_BUCKET } from '../lib/supabase';
import { Readable } from 'stream';
import FormData from 'form-data';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

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
    const { language, prompt, onProgress } = options;

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

      // Create a readable stream from buffer
      const audioStream = Readable.from(audioBuffer);
      
      // Create form data
      const formData = new FormData();
      formData.append('file', audioStream, {
        filename: fileName,
        contentType: `audio/${fileExtension}`,
      });
      formData.append('model', 'whisper-1');
      
      if (language) {
        formData.append('language', language);
      }
      
      if (prompt) {
        formData.append('prompt', prompt);
      }
      
      // Request detailed response format with timestamps
      formData.append('response_format', 'verbose_json');
      formData.append('timestamp_granularities[]', 'segment');

      // Send progress update
      onProgress?.({
        transcriptId,
        progress: 30,
        status: 'PROCESSING',
        message: 'Sending audio to OpenAI...',
      });

      // Call OpenAI Whisper API
      const response = await openai.audio.transcriptions.create({
        file: audioStream as any,
        model: 'whisper-1',
        language: language || undefined,
        prompt: prompt || undefined,
        response_format: 'verbose_json',
      });

      // Update progress
      onProgress?.({
        transcriptId,
        progress: 70,
        status: 'PROCESSING',
        message: 'Processing transcription results...',
      });

      // Process and save segments
      const segments = await this.processTranscriptionResponse(transcriptId, response);

      // Calculate total duration from segments
      const duration = segments.length > 0 
        ? Math.ceil(segments[segments.length - 1].endTime)
        : 0;

      // Update transcript with completed status
      await prisma.transcript.update({
        where: { id: transcriptId },
        data: {
          status: 'COMPLETED',
          duration,
          language: response.language || language || 'en',
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
        segments,
        language: response.language,
        duration,
        text: response.text,
      };

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
    const segments = response.segments || [];
    
    // Delete existing segments if any (for retries)
    await prisma.transcriptSegment.deleteMany({
      where: { transcriptId },
    });

    // Create new segments
    const createdSegments = await Promise.all(
      segments.map(async (segment: any, index: number) => {
        return prisma.transcriptSegment.create({
          data: {
            transcriptId,
            startTime: segment.start || 0,
            endTime: segment.end || 0,
            text: segment.text || '',
            speakerId: `SPEAKER_${(index % 3) + 1}`, // Basic speaker assignment
            confidence: segment.confidence || 0.9,
          },
        });
      })
    );

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