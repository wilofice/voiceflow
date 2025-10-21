import { prisma } from '@voiceflow-pro/database';
import { BatchJobStatus, BatchItemStatus } from '@prisma/client';
import { transcriptionQueue } from './queue';

interface BatchJobProgress {
  jobId: string;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  processingItems: number;
  estimatedTimeRemaining?: number;
  throughputMbps?: number;
}

interface QueuedItem {
  itemId: string;
  jobId: string;
  fileName: string;
  audioPath: string;
  startTime: number;
}

/**
 * BatchQueue Service
 * Manages batch transcription jobs with concurrency control
 */
class BatchQueue {
  // Active batch jobs being processed
  private activeJobs: Map<string, {
    concurrency: number;
    processing: Set<string>; // Item IDs currently being processed
    startTime: number;
    bytesProcessed: number;
  }> = new Map();

  // Queue of items waiting to be processed
  private itemQueue: Map<string, QueuedItem[]> = new Map();

  /**
   * Start processing a batch job
   */
  async startBatchJob(jobId: string): Promise<void> {
    const job = await prisma.batchJob.findUnique({
      where: { id: jobId },
      include: { items: true },
    });

    if (!job) {
      throw new Error(`Batch job ${jobId} not found`);
    }

    if (job.status === 'RUNNING') {
      throw new Error(`Batch job ${jobId} is already running`);
    }

    // Update job status to RUNNING
    await prisma.batchJob.update({
      where: { id: jobId },
      data: { status: 'RUNNING' },
    });

    // Initialize job tracking
    this.activeJobs.set(jobId, {
      concurrency: job.concurrency,
      processing: new Set(),
      startTime: Date.now(),
      bytesProcessed: 0,
    });

    // Queue all pending items
    const pendingItems = job.items.filter(
      item => item.status === 'PENDING' || item.status === 'ERROR'
    );

    this.itemQueue.set(jobId, pendingItems.map(item => ({
      itemId: item.id,
      jobId: item.batchJobId,
      fileName: item.fileName,
      audioPath: item.transcriptId || '', // Will be populated after upload
      startTime: Date.now(),
    })));

    // Start processing items
    this.processNextItems(jobId);
  }

  /**
   * Pause a batch job
   */
  async pauseBatchJob(jobId: string): Promise<void> {
    const job = await prisma.batchJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new Error(`Batch job ${jobId} not found`);
    }

    if (job.status !== 'RUNNING') {
      throw new Error(`Batch job ${jobId} is not running`);
    }

    // Update status to PAUSED
    await prisma.batchJob.update({
      where: { id: jobId },
      data: { status: 'PAUSED' },
    });

    // Keep items in queue but stop processing new ones
    // Currently processing items will complete
  }

  /**
   * Resume a paused batch job
   */
  async resumeBatchJob(jobId: string): Promise<void> {
    const job = await prisma.batchJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new Error(`Batch job ${jobId} not found`);
    }

    if (job.status !== 'PAUSED') {
      throw new Error(`Batch job ${jobId} is not paused`);
    }

    // Update status to RUNNING
    await prisma.batchJob.update({
      where: { id: jobId },
      data: { status: 'RUNNING' },
    });

    // Resume processing
    this.processNextItems(jobId);
  }

  /**
   * Cancel a batch job and all pending items
   */
  async cancelBatchJob(jobId: string): Promise<void> {
    const job = await prisma.batchJob.findUnique({
      where: { id: jobId },
      include: { items: true },
    });

    if (!job) {
      throw new Error(`Batch job ${jobId} not found`);
    }

    // Update all pending items to cancelled
    await prisma.batchItem.updateMany({
      where: {
        batchJobId: jobId,
        status: { in: ['PENDING', 'PROCESSING'] },
      },
      data: { status: 'CANCELLED' },
    });

    // Update job status
    const cancelledCount = job.items.filter(
      item => item.status === 'PENDING' || item.status === 'PROCESSING'
    ).length;

    await prisma.batchJob.update({
      where: { id: jobId },
      data: {
        status: 'ERROR',
        failedItems: { increment: cancelledCount },
      },
    });

    // Remove from active jobs
    this.activeJobs.delete(jobId);
    this.itemQueue.delete(jobId);
  }

  /**
   * Process next items respecting concurrency limit
   */
  private async processNextItems(jobId: string): Promise<void> {
    const jobState = this.activeJobs.get(jobId);
    if (!jobState) return;

    const queue = this.itemQueue.get(jobId);
    if (!queue || queue.length === 0) {
      // Check if all items are done
      await this.checkJobCompletion(jobId);
      return;
    }

    // Get current job to check if still running
    const job = await prisma.batchJob.findUnique({
      where: { id: jobId },
    });

    if (!job || job.status !== 'RUNNING') {
      return; // Job was paused or stopped
    }

    // Calculate how many more items we can process
    const availableSlots = jobState.concurrency - jobState.processing.size;

    if (availableSlots <= 0) {
      return; // Already at capacity
    }

    // Start processing items up to concurrency limit
    const itemsToProcess = queue.splice(0, availableSlots);

    for (const item of itemsToProcess) {
      jobState.processing.add(item.itemId);
      this.processItem(item).catch(error => {
        console.error(`Error processing item ${item.itemId}:`, error);
      });
    }

    // Update the queue
    this.itemQueue.set(jobId, queue);
  }

  /**
   * Process a single batch item
   */
  private async processItem(queuedItem: QueuedItem): Promise<void> {
    const { itemId, jobId } = queuedItem;
    const jobState = this.activeJobs.get(jobId);

    try {
      // Update item status to PROCESSING
      const item = await prisma.batchItem.update({
        where: { id: itemId },
        data: {
          status: 'PROCESSING',
          progress: 0,
        },
      });

      // If item doesn't have a transcript yet, it needs to be uploaded first
      if (!item.transcriptId) {
        throw new Error('Item must be uploaded before processing');
      }

      // Get transcript details
      const transcript = await prisma.transcript.findUnique({
        where: { id: item.transcriptId },
      });

      if (!transcript || !transcript.audioUrl) {
        throw new Error('Transcript or audio not found');
      }

      // Queue for transcription using existing transcription service
      await transcriptionQueue.addJob(transcript.id, transcript.audioUrl);

      // Monitor transcription progress
      // This would be updated via WebSocket events from the transcription service
      // For now, we'll just mark as queued
      await prisma.batchItem.update({
        where: { id: itemId },
        data: {
          status: 'PROCESSING',
          progress: 10, // Queued for transcription
        },
      });

      // Note: The actual completion will be handled by webhook/event
      // from the transcription service

    } catch (error) {
      console.error(`Failed to process item ${itemId}:`, error);

      // Update item as failed
      await prisma.batchItem.update({
        where: { id: itemId },
        data: {
          status: 'ERROR',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          progress: 0,
        },
      });

      // Update job failed count
      await prisma.batchJob.update({
        where: { id: jobId },
        data: { failedItems: { increment: 1 } },
      });

    } finally {
      // Remove from processing set
      if (jobState) {
        jobState.processing.delete(itemId);
      }

      // Process next items
      await this.processNextItems(jobId);
    }
  }

  /**
   * Handle item completion (called by transcription service webhook)
   */
  async handleItemCompleted(itemId: string, success: boolean, confidence?: number): Promise<void> {
    const item = await prisma.batchItem.findUnique({
      where: { id: itemId },
      include: { transcript: true },
    });

    if (!item) {
      console.error(`Item ${itemId} not found`);
      return;
    }

    const jobState = this.activeJobs.get(item.batchJobId);

    if (success) {
      // Update item as completed
      await prisma.batchItem.update({
        where: { id: itemId },
        data: {
          status: 'COMPLETED',
          progress: 100,
          confidence: confidence ?? null,
          duration: item.transcript?.duration ?? 0,
        },
      });

      // Update job completed count
      await prisma.batchJob.update({
        where: { id: item.batchJobId },
        data: { completedItems: { increment: 1 } },
      });

      // Update throughput stats
      if (jobState && item.fileSize) {
        jobState.bytesProcessed += item.fileSize;
      }

    } else {
      // Update item as failed
      await prisma.batchItem.update({
        where: { id: itemId },
        data: {
          status: 'ERROR',
          progress: 0,
          errorMessage: 'Transcription failed',
        },
      });

      // Update job failed count
      await prisma.batchJob.update({
        where: { id: item.batchJobId },
        data: { failedItems: { increment: 1 } },
      });
    }

    // Remove from processing
    if (jobState) {
      jobState.processing.delete(itemId);
    }

    // Update job progress
    await this.updateJobProgress(item.batchJobId);

    // Process next items
    await this.processNextItems(item.batchJobId);

    // Check if job is complete
    await this.checkJobCompletion(item.batchJobId);
  }

  /**
   * Update job progress statistics
   */
  private async updateJobProgress(jobId: string): Promise<BatchJobProgress> {
    const job = await prisma.batchJob.findUnique({
      where: { id: jobId },
      include: { items: true },
    });

    if (!job) {
      throw new Error(`Batch job ${jobId} not found`);
    }

    const jobState = this.activeJobs.get(jobId);
    const processingCount = jobState?.processing.size ?? 0;

    // Calculate ETA
    let estimatedTimeRemaining: number | undefined;
    if (jobState && job.completedItems > 0) {
      const elapsedSeconds = (Date.now() - jobState.startTime) / 1000;
      const itemsPerSecond = job.completedItems / elapsedSeconds;
      const remainingItems = job.totalItems - job.completedItems - job.failedItems;
      estimatedTimeRemaining = Math.ceil(remainingItems / itemsPerSecond);
    }

    // Calculate throughput
    let throughputMbps: number | undefined;
    if (jobState && jobState.bytesProcessed > 0) {
      const elapsedSeconds = (Date.now() - jobState.startTime) / 1000;
      throughputMbps = (jobState.bytesProcessed / 1024 / 1024) / elapsedSeconds; // MB/s
    }

    // Update job with stats
    await prisma.batchJob.update({
      where: { id: jobId },
      data: {
        estimatedTimeRemaining,
        throughputMbps,
      },
    });

    return {
      jobId,
      totalItems: job.totalItems,
      completedItems: job.completedItems,
      failedItems: job.failedItems,
      processingItems: processingCount,
      estimatedTimeRemaining,
      throughputMbps,
    };
  }

  /**
   * Check if batch job is complete
   */
  private async checkJobCompletion(jobId: string): Promise<void> {
    const job = await prisma.batchJob.findUnique({
      where: { id: jobId },
      include: { items: true },
    });

    if (!job) return;

    const jobState = this.activeJobs.get(jobId);
    const allProcessed = job.completedItems + job.failedItems >= job.totalItems;
    const nothingProcessing = !jobState || jobState.processing.size === 0;
    const queueEmpty = !this.itemQueue.get(jobId) || this.itemQueue.get(jobId)!.length === 0;

    if (allProcessed && nothingProcessing && queueEmpty) {
      // Job is complete
      const status: BatchJobStatus = job.failedItems === 0 ? 'COMPLETED' : 'ERROR';

      await prisma.batchJob.update({
        where: { id: jobId },
        data: {
          status,
          estimatedTimeRemaining: 0,
        },
      });

      // Clean up
      this.activeJobs.delete(jobId);
      this.itemQueue.delete(jobId);

      console.log(`Batch job ${jobId} completed with status ${status}`);
    }
  }

  /**
   * Get status of a batch job
   */
  async getBatchJobStatus(jobId: string): Promise<BatchJobProgress> {
    return this.updateJobProgress(jobId);
  }

  /**
   * Retry a failed item
   */
  async retryItem(itemId: string): Promise<void> {
    const item = await prisma.batchItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new Error(`Item ${itemId} not found`);
    }

    if (item.status !== 'ERROR') {
      throw new Error(`Item ${itemId} is not in error state`);
    }

    // Reset item to pending
    await prisma.batchItem.update({
      where: { id: itemId },
      data: {
        status: 'PENDING',
        progress: 0,
        errorMessage: null,
      },
    });

    // Decrement failed count
    await prisma.batchJob.update({
      where: { id: item.batchJobId },
      data: { failedItems: { decrement: 1 } },
    });

    // Add back to queue
    const queue = this.itemQueue.get(item.batchJobId) || [];
    queue.push({
      itemId: item.id,
      jobId: item.batchJobId,
      fileName: item.fileName,
      audioPath: item.transcriptId || '',
      startTime: Date.now(),
    });
    this.itemQueue.set(item.batchJobId, queue);

    // Process if job is running
    const job = await prisma.batchJob.findUnique({
      where: { id: item.batchJobId },
    });

    if (job?.status === 'RUNNING') {
      await this.processNextItems(item.batchJobId);
    }
  }
}

// Export singleton instance
export const batchQueue = new BatchQueue();
