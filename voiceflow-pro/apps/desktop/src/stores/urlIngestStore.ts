/**
 * URL Ingest Store
 * Zustand store for managing URL ingest state
 */

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';

import type { Provider } from '../main/services/urlIngest/urlValidatorService';

export type IngestStatus = 
  | 'idle' 
  | 'validating' 
  | 'downloading' 
  | 'transcribing' 
  | 'complete' 
  | 'error'
  | 'paused';

export interface URLMetadata {
  title?: string;
  duration?: number;
  thumbnail?: string;
  author?: string;
  description?: string;
  publishDate?: string;
  fileSize?: number;
}

export interface DownloadProgress {
  percent: number;
  downloaded: number;
  total: number;
  speed: number; // bytes per second
  eta: number; // seconds remaining
}

export interface TranscriptionProgress {
  percent: number;
  currentTime: number;
  totalTime: number;
  text: string; // partial transcript
}

export interface URLIngestJob {
  id: string;
  url: string;
  status: IngestStatus;
  provider: Provider | null;
  metadata: URLMetadata;
  downloadProgress: DownloadProgress | null;
  transcriptionProgress: TranscriptionProgress | null;
  error: string | null;
  downloadPath: string | null;
  transcriptPath: string | null;
  startTime: number;
  endTime?: number;
  retryCount: number;
}

interface URLIngestState {
  // Current active job
  currentJob: URLIngestJob | null;
  
  // Job history
  jobs: URLIngestJob[];
  
  // Global settings
  settings: {
    autoTranscribe: boolean;
    downloadQuality: 'best' | 'good' | 'worst';
    outputFormat: 'mp3' | 'wav' | 'm4a';
    savePath: string;
    maxRetries: number;
    concurrentDownloads: number;
  };

  // Actions
  createJob: (url: string) => string; // Returns job ID
  updateJob: (jobId: string, updates: Partial<URLIngestJob>) => void;
  setCurrentJob: (jobId: string | null) => void;
  updateDownloadProgress: (jobId: string, progress: DownloadProgress) => void;
  updateTranscriptionProgress: (jobId: string, progress: TranscriptionProgress) => void;
  setJobError: (jobId: string, error: string) => void;
  retryJob: (jobId: string) => void;
  cancelJob: (jobId: string) => void;
  clearJobs: () => void;
  updateSettings: (settings: Partial<URLIngestState['settings']>) => void;
  
  // Computed getters
  getJob: (jobId: string) => URLIngestJob | undefined;
  getActiveJobs: () => URLIngestJob[];
  getCompletedJobs: () => URLIngestJob[];
  getFailedJobs: () => URLIngestJob[];
}

// Initial state
const initialState = {
  currentJob: null,
  jobs: [],
  settings: {
    autoTranscribe: true,
    downloadQuality: 'best' as const,
    outputFormat: 'mp3' as const,
    savePath: '', // Will be set to app.getPath('downloads')
    maxRetries: 3,
    concurrentDownloads: 2
  }
};

// Create the store
export const useURLIngestStore = create<URLIngestState>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      ...initialState,

      // Create a new job
      createJob: (url: string) => {
        const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newJob: URLIngestJob = {
          id: jobId,
          url,
          status: 'idle',
          provider: null,
          metadata: {},
          downloadProgress: null,
          transcriptionProgress: null,
          error: null,
          downloadPath: null,
          transcriptPath: null,
          startTime: Date.now(),
          retryCount: 0
        };

        set((state) => ({
          jobs: [...state.jobs, newJob],
          currentJob: newJob
        }));

        return jobId;
      },

      // Update a job
      updateJob: (jobId: string, updates: Partial<URLIngestJob>) => {
        set((state) => ({
          jobs: state.jobs.map(job => 
            job.id === jobId ? { ...job, ...updates } : job
          ),
          currentJob: state.currentJob?.id === jobId 
            ? { ...state.currentJob, ...updates }
            : state.currentJob
        }));
      },

      // Set current active job
      setCurrentJob: (jobId: string | null) => {
        const job = jobId ? get().getJob(jobId) : null;
        set({ currentJob: job || null });
      },

      // Update download progress
      updateDownloadProgress: (jobId: string, progress: DownloadProgress) => {
        set((state) => ({
          jobs: state.jobs.map(job => 
            job.id === jobId 
              ? { ...job, downloadProgress: progress, status: 'downloading' as IngestStatus }
              : job
          ),
          currentJob: state.currentJob?.id === jobId
            ? { ...state.currentJob, downloadProgress: progress, status: 'downloading' as IngestStatus }
            : state.currentJob
        }));
      },

      // Update transcription progress
      updateTranscriptionProgress: (jobId: string, progress: TranscriptionProgress) => {
        set((state) => ({
          jobs: state.jobs.map(job => 
            job.id === jobId 
              ? { ...job, transcriptionProgress: progress, status: 'transcribing' as IngestStatus }
              : job
          ),
          currentJob: state.currentJob?.id === jobId
            ? { ...state.currentJob, transcriptionProgress: progress, status: 'transcribing' as IngestStatus }
            : state.currentJob
        }));
      },

      // Set job error
      setJobError: (jobId: string, error: string) => {
        set((state) => ({
          jobs: state.jobs.map(job => 
            job.id === jobId 
              ? { ...job, error, status: 'error' as IngestStatus, endTime: Date.now() }
              : job
          ),
          currentJob: state.currentJob?.id === jobId
            ? { ...state.currentJob, error, status: 'error' as IngestStatus, endTime: Date.now() }
            : state.currentJob
        }));
      },

      // Retry a failed job
      retryJob: (jobId: string) => {
        set((state) => ({
          jobs: state.jobs.map(job => 
            job.id === jobId 
              ? { 
                  ...job, 
                  status: 'idle' as IngestStatus, 
                  error: null, 
                  retryCount: job.retryCount + 1,
                  downloadProgress: null,
                  transcriptionProgress: null
                }
              : job
          )
        }));
      },

      // Cancel a job
      cancelJob: (jobId: string) => {
        set((state) => ({
          jobs: state.jobs.map(job => 
            job.id === jobId 
              ? { ...job, status: 'error' as IngestStatus, error: 'Cancelled by user', endTime: Date.now() }
              : job
          ),
          currentJob: state.currentJob?.id === jobId ? null : state.currentJob
        }));
      },

      // Clear all jobs
      clearJobs: () => {
        set({ jobs: [], currentJob: null });
      },

      // Update settings
      updateSettings: (newSettings: Partial<URLIngestState['settings']>) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings }
        }));
      },

      // Get a specific job
      getJob: (jobId: string) => {
        return get().jobs.find(job => job.id === jobId);
      },

      // Get active jobs (downloading or transcribing)
      getActiveJobs: () => {
        return get().jobs.filter(job => 
          ['validating', 'downloading', 'transcribing'].includes(job.status)
        );
      },

      // Get completed jobs
      getCompletedJobs: () => {
        return get().jobs.filter(job => job.status === 'complete');
      },

      // Get failed jobs
      getFailedJobs: () => {
        return get().jobs.filter(job => job.status === 'error');
      }
    })),
    {
      name: 'url-ingest-store'
    }
  )
);

// Selectors for common use cases
export const selectCurrentJob = (state: URLIngestState) => state.currentJob;
export const selectActiveJobs = (state: URLIngestState) => state.getActiveJobs();
export const selectJobById = (jobId: string) => (state: URLIngestState) => state.getJob(jobId);
export const selectSettings = (state: URLIngestState) => state.settings;

// Helper function to format time
export function formatETA(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
}

// Helper function to format bytes
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

// Helper function to format speed
export function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}