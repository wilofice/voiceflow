import { TranscriptionService } from './transcription';
import { prisma } from '@voiceflow-pro/database';
import { supabaseAdmin } from '../lib/supabase';

// Simple in-memory queue for development
// In production, use Redis Queue or similar
class TranscriptionQueue {
  private queue: Map<string, any> = new Map();
  private processing: Set<string> = new Set();

  async addJob(transcriptId: string, audioPath: string) {
    this.queue.set(transcriptId, {
      transcriptId,
      audioPath,
      addedAt: new Date(),
      attempts: 0,
    });

    // Process immediately in development
    this.processNext();
  }

  private async processNext() {
    // Get next job that's not being processed
    const nextJob = Array.from(this.queue.values()).find(
      job => !this.processing.has(job.transcriptId)
    );

    if (!nextJob) return;

    this.processing.add(nextJob.transcriptId);

    try {
      await this.processJob(nextJob);
      this.queue.delete(nextJob.transcriptId);
    } catch (error) {
      console.error(`Failed to process job ${nextJob.transcriptId}:`, error);
      
      // Increment attempts
      nextJob.attempts++;
      
      if (nextJob.attempts >= 3) {
        // Max retries reached, remove from queue
        this.queue.delete(nextJob.transcriptId);
        
        // Update transcript status to failed
        await prisma.transcript.update({
          where: { id: nextJob.transcriptId },
          data: { status: 'FAILED' },
        });
      }
    } finally {
      this.processing.delete(nextJob.transcriptId);
    }
  }

  private async processJob(job: any) {
    const { transcriptId, audioPath } = job;

    // Get transcript details
    const transcript = await prisma.transcript.findUnique({
      where: { id: transcriptId },
    });

    if (!transcript) {
      throw new Error('Transcript not found');
    }

    // Download audio file from storage
    const { data, error } = await supabaseAdmin.storage
      .from('audio-files')
      .download(audioPath);

    if (error) {
      throw new Error(`Failed to download audio file: ${error.message}`);
    }

    // Convert blob to buffer
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Get filename from path
    const fileName = audioPath.split('/').pop() || 'audio.mp3';

    // Transcribe the file
    await TranscriptionService.transcribeFile(
      transcriptId,
      buffer,
      fileName,
      {
        language: transcript.language,
        onProgress: (progress) => {
          console.log(`Transcription progress for ${transcriptId}:`, progress);
          
          // In production, emit this via WebSocket
          // io.to(transcript.userId).emit('transcription:progress', progress);
        },
      }
    );
  }

  getQueueStatus() {
    return {
      queued: this.queue.size,
      processing: this.processing.size,
      jobs: Array.from(this.queue.values()).map(job => ({
        transcriptId: job.transcriptId,
        attempts: job.attempts,
        addedAt: job.addedAt,
      })),
    };
  }
}

// Export singleton instance
export const transcriptionQueue = new TranscriptionQueue();