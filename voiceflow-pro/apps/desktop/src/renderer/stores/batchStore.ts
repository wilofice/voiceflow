import { create } from 'zustand';

import { apiClient } from '../services/apiClient';
import {
  BatchJob,
  BatchItem,
  BatchJobWithItems,
  CreateBatchJobRequest,
  UpdateBatchJobRequest,
  PaginatedResponse,
} from '../types/api';

interface BatchState {
  jobs: Record<string, BatchJobWithItems>;
  jobsList: BatchJob[];
  currentJob: BatchJobWithItems | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null;
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  error: string | null;

  // Actions
  fetchJobs: (page?: number, limit?: number, status?: string) => Promise<void>;
  fetchJob: (id: string) => Promise<void>;
  createJob: (data: CreateBatchJobRequest) => Promise<BatchJob>;
  updateJob: (id: string, data: UpdateBatchJobRequest) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;
  startJob: (id: string) => Promise<void>;
  pauseJob: (id: string) => Promise<void>;
  resumeJob: (id: string) => Promise<void>;
  cancelJob: (id: string) => Promise<void>;
  addFiles: (jobId: string, files: File[]) => Promise<void>;
  removeItem: (jobId: string, itemId: string) => Promise<void>;
  retryItem: (jobId: string, itemId: string) => Promise<void>;
  setCurrentJob: (jobId: string | null) => void;
  clearError: () => void;
}

export const useBatchStore = create<BatchState>((set, get) => ({
  jobs: {},
  jobsList: [],
  currentJob: null,
  pagination: null,
  isLoading: false,
  isCreating: false,
  isUpdating: false,
  error: null,

  fetchJobs: async (page = 1, limit = 20, status) => {
    set({ isLoading: true, error: null });
    try {
      const response: PaginatedResponse<BatchJob> = await apiClient.getBatchJobs(page, limit, status);
      set({
        jobsList: response.data,
        pagination: response.pagination,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        jobsList: [],
        pagination: null,
        isLoading: false,
        error: error.message || 'Failed to fetch batch jobs',
      });
      console.error('Failed to fetch batch jobs:', error);
    }
  },

  fetchJob: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const job = await apiClient.getBatchJob(id);
      const { jobs } = get();
      set({
        jobs: { ...jobs, [id]: job },
        currentJob: job,
        isLoading: false,
      });

      // Subscribe to WebSocket updates for this job
      apiClient.subscribeToBatchJob(id);
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.message || 'Failed to fetch batch job',
      });
      console.error('Failed to fetch batch job:', error);
    }
  },

  createJob: async (data: CreateBatchJobRequest) => {
    set({ isCreating: true, error: null });
    try {
      const job = await apiClient.createBatchJob(data);
      const { jobsList } = get();
      set({
        jobsList: [job, ...jobsList],
        isCreating: false,
      });
      return job;
    } catch (error: any) {
      console.error('Failed to create batch job:', error);
      set({
        isCreating: false,
        error: error.message || 'Failed to create batch job',
      });
      throw error;
    }
  },

  updateJob: async (id: string, data: UpdateBatchJobRequest) => {
    set({ isUpdating: true, error: null });
    try {
      const updated = await apiClient.updateBatchJob(id, data);
      const { jobs, jobsList, currentJob } = get();

      set({
        jobs: jobs[id] ? { ...jobs, [id]: { ...jobs[id], ...updated } } : jobs,
        jobsList: jobsList.map(j => j.id === id ? { ...j, ...updated } : j),
        currentJob: currentJob?.id === id ? { ...currentJob, ...updated } : currentJob,
        isUpdating: false,
      });
    } catch (error: any) {
      set({
        isUpdating: false,
        error: error.message || 'Failed to update batch job',
      });
      throw error;
    }
  },

  deleteJob: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await apiClient.deleteBatchJob(id);
      const { jobs, jobsList, currentJob } = get();

      const newJobs = { ...jobs };
      delete newJobs[id];

      set({
        jobs: newJobs,
        jobsList: jobsList.filter(j => j.id !== id),
        currentJob: currentJob?.id === id ? null : currentJob,
        isLoading: false,
      });

      // Unsubscribe from WebSocket
      apiClient.unsubscribeFromBatchJob(id);
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.message || 'Failed to delete batch job',
      });
      throw error;
    }
  },

  startJob: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await apiClient.startBatchJob(id);
      const { jobs, jobsList, currentJob } = get();

      set({
        jobs: jobs[id] ? { ...jobs, [id]: { ...jobs[id], ...updated } } : jobs,
        jobsList: jobsList.map(j => j.id === id ? { ...j, ...updated } : j),
        currentJob: currentJob?.id === id ? { ...currentJob, ...updated } : currentJob,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.message || 'Failed to start batch job',
      });
      throw error;
    }
  },

  pauseJob: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await apiClient.pauseBatchJob(id);
      const { jobs, jobsList, currentJob } = get();

      set({
        jobs: jobs[id] ? { ...jobs, [id]: { ...jobs[id], ...updated } } : jobs,
        jobsList: jobsList.map(j => j.id === id ? { ...j, ...updated } : j),
        currentJob: currentJob?.id === id ? { ...currentJob, ...updated } : currentJob,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.message || 'Failed to pause batch job',
      });
      throw error;
    }
  },

  resumeJob: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await apiClient.resumeBatchJob(id);
      const { jobs, jobsList, currentJob } = get();

      set({
        jobs: jobs[id] ? { ...jobs, [id]: { ...jobs[id], ...updated } } : jobs,
        jobsList: jobsList.map(j => j.id === id ? { ...j, ...updated } : j),
        currentJob: currentJob?.id === id ? { ...currentJob, ...updated } : currentJob,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.message || 'Failed to resume batch job',
      });
      throw error;
    }
  },

  cancelJob: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await apiClient.cancelBatchJob(id);
      const { jobs, jobsList, currentJob } = get();

      set({
        jobs: jobs[id] ? { ...jobs, [id]: { ...jobs[id], ...updated } } : jobs,
        jobsList: jobsList.map(j => j.id === id ? { ...j, ...updated } : j),
        currentJob: currentJob?.id === id ? { ...currentJob, ...updated } : currentJob,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.message || 'Failed to cancel batch job',
      });
      throw error;
    }
  },

  addFiles: async (jobId: string, files: File[]) => {
    set({ isLoading: true, error: null });
    try {
      const result = await apiClient.addFilesToBatch(jobId, files);

      // Refresh the job to get updated items
      const job = await apiClient.getBatchJob(jobId);
      const { jobs, jobsList, currentJob } = get();

      set({
        jobs: { ...jobs, [jobId]: job },
        jobsList: jobsList.map(j => j.id === jobId ? { ...j, totalItems: job.totalItems } : j),
        currentJob: currentJob?.id === jobId ? job : currentJob,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.message || 'Failed to add files to batch',
      });
      throw error;
    }
  },

  removeItem: async (jobId: string, itemId: string) => {
    set({ isLoading: true, error: null });
    try {
      await apiClient.removeBatchItem(jobId, itemId);

      // Update local state
      const { jobs, currentJob } = get();
      if (jobs[jobId]) {
        const updatedJob = {
          ...jobs[jobId],
          items: jobs[jobId].items.filter(item => item.id !== itemId),
          totalItems: jobs[jobId].totalItems - 1,
        };
        set({
          jobs: { ...jobs, [jobId]: updatedJob },
          currentJob: currentJob?.id === jobId ? updatedJob : currentJob,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.message || 'Failed to remove batch item',
      });
      throw error;
    }
  },

  retryItem: async (jobId: string, itemId: string) => {
    set({ isLoading: true, error: null });
    try {
      const updatedItem = await apiClient.retryBatchItem(jobId, itemId);

      // Update local state
      const { jobs, currentJob } = get();
      if (jobs[jobId]) {
        const updatedJob = {
          ...jobs[jobId],
          items: jobs[jobId].items.map(item => item.id === itemId ? updatedItem : item),
          failedItems: jobs[jobId].failedItems - 1,
        };
        set({
          jobs: { ...jobs, [jobId]: updatedJob },
          currentJob: currentJob?.id === jobId ? updatedJob : currentJob,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.message || 'Failed to retry batch item',
      });
      throw error;
    }
  },

  setCurrentJob: (jobId: string | null) => {
    if (jobId === null) {
      // Unsubscribe from current job if any
      const { currentJob } = get();
      if (currentJob) {
        apiClient.unsubscribeFromBatchJob(currentJob.id);
      }
      set({ currentJob: null });
      return;
    }

    const { jobs } = get();
    if (jobs[jobId]) {
      set({ currentJob: jobs[jobId] });
      apiClient.subscribeToBatchJob(jobId);
    } else {
      // Fetch job if not in cache
      get().fetchJob(jobId);
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));

// Set up WebSocket event listeners
apiClient.on('batch:job_progress', (data: any) => {
  const { jobs, jobsList, currentJob } = useBatchStore.getState();
  const { jobId, ...progress } = data;

  if (jobs[jobId]) {
    const updatedJob = { ...jobs[jobId], ...progress };
    useBatchStore.setState({
      jobs: { ...jobs, [jobId]: updatedJob },
      jobsList: jobsList.map(j => j.id === jobId ? { ...j, ...progress } : j),
      currentJob: currentJob?.id === jobId ? updatedJob : currentJob,
    });
  }
});

apiClient.on('batch:item_progress', (data: any) => {
  const { jobs, currentJob } = useBatchStore.getState();
  const { jobId, itemId, progress } = data;

  if (jobs[jobId]) {
    const updatedJob = {
      ...jobs[jobId],
      items: jobs[jobId].items.map(item =>
        item.id === itemId ? { ...item, progress } : item
      ),
    };
    useBatchStore.setState({
      jobs: { ...jobs, [jobId]: updatedJob },
      currentJob: currentJob?.id === jobId ? updatedJob : currentJob,
    });
  }
});

apiClient.on('batch:item_completed', (data: any) => {
  const { jobs, jobsList, currentJob } = useBatchStore.getState();
  const { jobId, itemId, item: updatedItem } = data;

  if (jobs[jobId]) {
    const updatedJob = {
      ...jobs[jobId],
      items: jobs[jobId].items.map(item => item.id === itemId ? updatedItem : item),
      completedItems: jobs[jobId].completedItems + 1,
    };
    useBatchStore.setState({
      jobs: { ...jobs, [jobId]: updatedJob },
      jobsList: jobsList.map(j => j.id === jobId ? { ...j, completedItems: updatedJob.completedItems } : j),
      currentJob: currentJob?.id === jobId ? updatedJob : currentJob,
    });
  }
});

apiClient.on('batch:item_error', (data: any) => {
  const { jobs, jobsList, currentJob } = useBatchStore.getState();
  const { jobId, itemId, error } = data;

  if (jobs[jobId]) {
    const updatedJob = {
      ...jobs[jobId],
      items: jobs[jobId].items.map(item =>
        item.id === itemId ? { ...item, status: 'ERROR' as const, errorMessage: error } : item
      ),
      failedItems: jobs[jobId].failedItems + 1,
    };
    useBatchStore.setState({
      jobs: { ...jobs, [jobId]: updatedJob },
      jobsList: jobsList.map(j => j.id === jobId ? { ...j, failedItems: updatedJob.failedItems } : j),
      currentJob: currentJob?.id === jobId ? updatedJob : currentJob,
    });
  }
});

apiClient.on('batch:job_completed', (data: any) => {
  const { jobs, jobsList, currentJob } = useBatchStore.getState();
  const { jobId } = data;

  if (jobs[jobId]) {
    const updatedJob = { ...jobs[jobId], status: 'COMPLETED' as const };
    useBatchStore.setState({
      jobs: { ...jobs, [jobId]: updatedJob },
      jobsList: jobsList.map(j => j.id === jobId ? { ...j, status: 'COMPLETED' as const } : j),
      currentJob: currentJob?.id === jobId ? updatedJob : currentJob,
    });
  }
});

apiClient.on('batch:job_paused', (data: any) => {
  const { jobs, jobsList, currentJob } = useBatchStore.getState();
  const { jobId } = data;

  if (jobs[jobId]) {
    const updatedJob = { ...jobs[jobId], status: 'PAUSED' as const };
    useBatchStore.setState({
      jobs: { ...jobs, [jobId]: updatedJob },
      jobsList: jobsList.map(j => j.id === jobId ? { ...j, status: 'PAUSED' as const } : j),
      currentJob: currentJob?.id === jobId ? updatedJob : currentJob,
    });
  }
});

apiClient.on('batch:job_resumed', (data: any) => {
  const { jobs, jobsList, currentJob } = useBatchStore.getState();
  const { jobId } = data;

  if (jobs[jobId]) {
    const updatedJob = { ...jobs[jobId], status: 'RUNNING' as const };
    useBatchStore.setState({
      jobs: { ...jobs, [jobId]: updatedJob },
      jobsList: jobsList.map(j => j.id === jobId ? { ...j, status: 'RUNNING' as const } : j),
      currentJob: currentJob?.id === jobId ? updatedJob : currentJob,
    });
  }
});
