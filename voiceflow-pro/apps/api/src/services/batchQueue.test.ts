import { batchQueue } from './batchQueue';
import { prisma } from '@voiceflow-pro/database';
import { transcriptionQueue } from './queue';

// Mock dependencies
jest.mock('@voiceflow-pro/database', () => ({
  prisma: {
    batchJob: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    batchItem: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    transcript: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('./queue', () => ({
  transcriptionQueue: {
    addJob: jest.fn(),
  },
}));

describe('BatchQueue Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('startBatchJob', () => {
    it('should start a batch job and queue items', async () => {
      const mockJob = {
        id: 'job-1',
        userId: 'user-1',
        name: 'Test Job',
        status: 'DRAFT',
        concurrency: 3,
        totalItems: 2,
        completedItems: 0,
        failedItems: 0,
        items: [
          {
            id: 'item-1',
            batchJobId: 'job-1',
            fileName: 'test1.mp3',
            fileSize: 1000,
            status: 'PENDING',
            transcriptId: 'trans-1',
          },
          {
            id: 'item-2',
            batchJobId: 'job-1',
            fileName: 'test2.mp3',
            fileSize: 2000,
            status: 'PENDING',
            transcriptId: 'trans-2',
          },
        ],
      };

      (prisma.batchJob.findUnique as jest.Mock).mockResolvedValue(mockJob);
      (prisma.batchJob.update as jest.Mock).mockResolvedValue({ ...mockJob, status: 'RUNNING' });
      (prisma.batchItem.update as jest.Mock).mockResolvedValue({});
      (prisma.transcript.findUnique as jest.Mock).mockResolvedValue({
        id: 'trans-1',
        audioUrl: 'path/to/audio.mp3',
      });
      (transcriptionQueue.addJob as jest.Mock).mockResolvedValue(undefined);

      await batchQueue.startBatchJob('job-1');

      expect(prisma.batchJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: { status: 'RUNNING' },
      });
    });

    it('should throw error if job not found', async () => {
      (prisma.batchJob.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(batchQueue.startBatchJob('non-existent')).rejects.toThrow(
        'Batch job non-existent not found'
      );
    });

    it('should throw error if job is already running', async () => {
      const mockJob = {
        id: 'job-1',
        status: 'RUNNING',
        items: [],
      };

      (prisma.batchJob.findUnique as jest.Mock).mockResolvedValue(mockJob);

      await expect(batchQueue.startBatchJob('job-1')).rejects.toThrow(
        'Batch job job-1 is already running'
      );
    });
  });

  describe('pauseBatchJob', () => {
    it('should pause a running batch job', async () => {
      const mockJob = {
        id: 'job-1',
        status: 'RUNNING',
      };

      (prisma.batchJob.findUnique as jest.Mock).mockResolvedValue(mockJob);
      (prisma.batchJob.update as jest.Mock).mockResolvedValue({ ...mockJob, status: 'PAUSED' });

      await batchQueue.pauseBatchJob('job-1');

      expect(prisma.batchJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: { status: 'PAUSED' },
      });
    });

    it('should throw error if job is not running', async () => {
      const mockJob = {
        id: 'job-1',
        status: 'COMPLETED',
      };

      (prisma.batchJob.findUnique as jest.Mock).mockResolvedValue(mockJob);

      await expect(batchQueue.pauseBatchJob('job-1')).rejects.toThrow(
        'Batch job job-1 is not running'
      );
    });
  });

  describe('resumeBatchJob', () => {
    it('should resume a paused batch job', async () => {
      const mockJob = {
        id: 'job-1',
        status: 'PAUSED',
        concurrency: 3,
        items: [],
      };

      (prisma.batchJob.findUnique as jest.Mock).mockResolvedValue(mockJob);
      (prisma.batchJob.update as jest.Mock).mockResolvedValue({ ...mockJob, status: 'RUNNING' });

      await batchQueue.resumeBatchJob('job-1');

      expect(prisma.batchJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: { status: 'RUNNING' },
      });
    });

    it('should throw error if job is not paused', async () => {
      const mockJob = {
        id: 'job-1',
        status: 'RUNNING',
      };

      (prisma.batchJob.findUnique as jest.Mock).mockResolvedValue(mockJob);

      await expect(batchQueue.resumeBatchJob('job-1')).rejects.toThrow(
        'Batch job job-1 is not paused'
      );
    });
  });

  describe('cancelBatchJob', () => {
    it('should cancel all pending items and update job status', async () => {
      const mockJob = {
        id: 'job-1',
        status: 'RUNNING',
        items: [
          { id: 'item-1', status: 'PENDING' },
          { id: 'item-2', status: 'PROCESSING' },
          { id: 'item-3', status: 'COMPLETED' },
        ],
      };

      (prisma.batchJob.findUnique as jest.Mock).mockResolvedValue(mockJob);
      (prisma.batchItem.updateMany as jest.Mock).mockResolvedValue({ count: 2 });
      (prisma.batchJob.update as jest.Mock).mockResolvedValue({});

      await batchQueue.cancelBatchJob('job-1');

      expect(prisma.batchItem.updateMany).toHaveBeenCalledWith({
        where: {
          batchJobId: 'job-1',
          status: { in: ['PENDING', 'PROCESSING'] },
        },
        data: { status: 'CANCELLED' },
      });

      expect(prisma.batchJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: {
          status: 'ERROR',
          failedItems: { increment: 2 },
        },
      });
    });
  });

  describe('handleItemCompleted', () => {
    it('should handle successful item completion', async () => {
      const mockItem = {
        id: 'item-1',
        batchJobId: 'job-1',
        status: 'PROCESSING',
        fileSize: 1000,
        transcript: {
          id: 'trans-1',
          duration: 120,
        },
      };

      const mockJob = {
        id: 'job-1',
        status: 'RUNNING',
        totalItems: 2,
        completedItems: 0,
        failedItems: 0,
        concurrency: 3,
        items: [],
      };

      (prisma.batchItem.findUnique as jest.Mock).mockResolvedValue(mockItem);
      (prisma.batchItem.update as jest.Mock).mockResolvedValue({});
      (prisma.batchJob.update as jest.Mock).mockResolvedValue({});
      (prisma.batchJob.findUnique as jest.Mock).mockResolvedValue(mockJob);

      await batchQueue.handleItemCompleted('item-1', true, 0.95);

      expect(prisma.batchItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: {
          status: 'COMPLETED',
          progress: 100,
          confidence: 0.95,
          duration: 120,
        },
      });

      expect(prisma.batchJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: { completedItems: { increment: 1 } },
      });
    });

    it('should handle failed item completion', async () => {
      const mockItem = {
        id: 'item-1',
        batchJobId: 'job-1',
        status: 'PROCESSING',
        fileSize: 1000,
      };

      const mockJob = {
        id: 'job-1',
        status: 'RUNNING',
        totalItems: 2,
        completedItems: 0,
        failedItems: 0,
        concurrency: 3,
        items: [],
      };

      (prisma.batchItem.findUnique as jest.Mock).mockResolvedValue(mockItem);
      (prisma.batchItem.update as jest.Mock).mockResolvedValue({});
      (prisma.batchJob.update as jest.Mock).mockResolvedValue({});
      (prisma.batchJob.findUnique as jest.Mock).mockResolvedValue(mockJob);

      await batchQueue.handleItemCompleted('item-1', false);

      expect(prisma.batchItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: {
          status: 'ERROR',
          progress: 0,
          errorMessage: 'Transcription failed',
        },
      });

      expect(prisma.batchJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: { failedItems: { increment: 1 } },
      });
    });
  });

  describe('retryItem', () => {
    it('should retry a failed item', async () => {
      const mockItem = {
        id: 'item-1',
        batchJobId: 'job-1',
        fileName: 'test.mp3',
        status: 'ERROR',
        transcriptId: 'trans-1',
      };

      const mockJob = {
        id: 'job-1',
        status: 'RUNNING',
        concurrency: 3,
        totalItems: 2,
        completedItems: 0,
        failedItems: 1,
        items: [],
      };

      (prisma.batchItem.findUnique as jest.Mock).mockResolvedValue(mockItem);
      (prisma.batchItem.update as jest.Mock).mockResolvedValue({});
      (prisma.batchJob.update as jest.Mock).mockResolvedValue({});
      (prisma.batchJob.findUnique as jest.Mock).mockResolvedValue(mockJob);

      await batchQueue.retryItem('item-1');

      expect(prisma.batchItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: {
          status: 'PENDING',
          progress: 0,
          errorMessage: null,
        },
      });

      expect(prisma.batchJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: { failedItems: { decrement: 1 } },
      });
    });

    it('should throw error if item is not in error state', async () => {
      const mockItem = {
        id: 'item-1',
        status: 'COMPLETED',
      };

      (prisma.batchItem.findUnique as jest.Mock).mockResolvedValue(mockItem);

      await expect(batchQueue.retryItem('item-1')).rejects.toThrow(
        'Item item-1 is not in error state'
      );
    });
  });

  describe('concurrency control', () => {
    it('should respect concurrency limits', async () => {
      const mockJob = {
        id: 'job-1',
        userId: 'user-1',
        name: 'Test Job',
        status: 'DRAFT',
        concurrency: 2, // Only 2 items at once
        totalItems: 5,
        completedItems: 0,
        failedItems: 0,
        items: [
          { id: 'item-1', batchJobId: 'job-1', fileName: 'test1.mp3', fileSize: 1000, status: 'PENDING', transcriptId: 'trans-1' },
          { id: 'item-2', batchJobId: 'job-1', fileName: 'test2.mp3', fileSize: 1000, status: 'PENDING', transcriptId: 'trans-2' },
          { id: 'item-3', batchJobId: 'job-1', fileName: 'test3.mp3', fileSize: 1000, status: 'PENDING', transcriptId: 'trans-3' },
          { id: 'item-4', batchJobId: 'job-1', fileName: 'test4.mp3', fileSize: 1000, status: 'PENDING', transcriptId: 'trans-4' },
          { id: 'item-5', batchJobId: 'job-1', fileName: 'test5.mp3', fileSize: 1000, status: 'PENDING', transcriptId: 'trans-5' },
        ],
      };

      (prisma.batchJob.findUnique as jest.Mock).mockResolvedValue(mockJob);
      (prisma.batchJob.update as jest.Mock).mockResolvedValue({ ...mockJob, status: 'RUNNING' });
      (prisma.batchItem.update as jest.Mock).mockResolvedValue({});
      (prisma.transcript.findUnique as jest.Mock).mockResolvedValue({
        id: 'trans-1',
        audioUrl: 'path/to/audio.mp3',
      });
      (transcriptionQueue.addJob as jest.Mock).mockResolvedValue(undefined);

      await batchQueue.startBatchJob('job-1');

      // Should only process 2 items initially (concurrency limit)
      expect(transcriptionQueue.addJob).toHaveBeenCalledTimes(2);
    });
  });
});
