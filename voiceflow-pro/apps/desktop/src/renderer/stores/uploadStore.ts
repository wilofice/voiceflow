import { create } from 'zustand';
import { UploadResponse, UploadMetadata } from '../types/api';
import { apiClient } from '../services/apiClient';

interface UploadProgress {
  uploadId: string;
  fileName: string;
  progress: number;
  loaded: number;
  total: number;
  status: 'uploading' | 'completed' | 'failed';
  error?: string;
}

interface UploadState {
  uploads: Record<string, UploadProgress>;
  isUploading: boolean;
  error: string | null;
  
  // Actions
  uploadFile: (file: File, metadata?: UploadMetadata) => Promise<UploadResponse>;
  clearUploads: () => void;
  removeUpload: (uploadId: string) => void;
  clearError: () => void;
}

export const useUploadStore = create<UploadState>((set, get) => ({
  uploads: {},
  isUploading: false,
  error: null,

  uploadFile: async (file: File, metadata = {}) => {
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    
    set((state) => ({
      uploads: {
        ...state.uploads,
        [uploadId]: {
          uploadId,
          fileName: file.name,
          progress: 0,
          loaded: 0,
          total: file.size,
          status: 'uploading',
        },
      },
      isUploading: true,
      error: null,
    }));

    try {
      const response = await apiClient.uploadFile(
        file,
        metadata,
        (progress, loaded, total) => {
          set((state) => ({
            uploads: {
              ...state.uploads,
              [uploadId]: {
                ...state.uploads[uploadId],
                progress,
                loaded,
                total,
              },
            },
          }));
        }
      );

      set((state) => ({
        uploads: {
          ...state.uploads,
          [uploadId]: {
            ...state.uploads[uploadId],
            status: 'completed',
            progress: 100,
          },
        },
        isUploading: Object.values(state.uploads).some(
          upload => upload.status === 'uploading' && upload.uploadId !== uploadId
        ),
      }));

      return response;
    } catch (error: any) {
      set((state) => ({
        uploads: {
          ...state.uploads,
          [uploadId]: {
            ...state.uploads[uploadId],
            status: 'failed',
            error: error.message || 'Upload failed',
          },
        },
        isUploading: Object.values(state.uploads).some(
          upload => upload.status === 'uploading' && upload.uploadId !== uploadId
        ),
        error: error.message || 'Upload failed',
      }));
      throw error;
    }
  },

  clearUploads: () => {
    set({ uploads: {}, isUploading: false, error: null });
  },

  removeUpload: (uploadId: string) => {
    set((state) => {
      const { [uploadId]: removed, ...remainingUploads } = state.uploads;
      return {
        uploads: remainingUploads,
        isUploading: Object.values(remainingUploads).some(
          upload => upload.status === 'uploading'
        ),
      };
    });
  },

  clearError: () => {
    set({ error: null });
  },
}));