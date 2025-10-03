import { create } from 'zustand';

import { apiClient } from '../services/apiClient';
import { 
  Transcript, 
  CreateTranscriptRequest, 
  UpdateTranscriptRequest, 
  PaginatedResponse 
} from '../types/api';

interface TranscriptState {
  transcripts: Transcript[];
  currentTranscript: Transcript | null;
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
  fetchTranscripts: (page?: number, limit?: number, status?: string) => Promise<void>;
  createTranscript: (data: CreateTranscriptRequest) => Promise<Transcript>;
  updateTranscript: (id: string, data: UpdateTranscriptRequest) => Promise<void>;
  deleteTranscript: (id: string) => Promise<void>;
  fetchTranscript: (id: string) => Promise<void>;
  retryTranscription: (id: string) => Promise<void>;
  clearCurrentTranscript: () => void;
  clearError: () => void;
  subscribeToTranscript: (id: string) => void;
  unsubscribeFromTranscript: (id: string) => void;
}

export const useTranscriptStore = create<TranscriptState>((set, get) => ({
  transcripts: [],
  currentTranscript: null,
  pagination: null,
  isLoading: false,
  isCreating: false,
  isUpdating: false,
  error: null,

  fetchTranscripts: async (page = 1, limit = 20, status) => {
    set({ isLoading: true, error: null });
    try {
      const response: PaginatedResponse<Transcript> = await apiClient.getTranscripts(page, limit, status);
      set({
        transcripts: response.data,
        pagination: response.pagination,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.message || 'Failed to fetch transcripts',
      });
      throw error;
    }
  },

  createTranscript: async (data: CreateTranscriptRequest) => {
    set({ isCreating: true, error: null });
    try {
      const transcript = await apiClient.createTranscript(data);
      const { transcripts } = get();
      set({
        transcripts: [transcript, ...transcripts],
        isCreating: false,
      });
      return transcript;
    } catch (error: any) {
      set({
        isCreating: false,
        error: error.message || 'Failed to create transcript',
      });
      throw error;
    }
  },

  updateTranscript: async (id: string, data: UpdateTranscriptRequest) => {
    set({ isUpdating: true, error: null });
    try {
      const updatedTranscript = await apiClient.updateTranscript(id, data);
      const { transcripts, currentTranscript } = get();
      
      set({
        transcripts: transcripts.map(t => t.id === id ? { ...t, ...updatedTranscript } : t),
        currentTranscript: currentTranscript?.id === id 
          ? { ...currentTranscript, ...updatedTranscript } 
          : currentTranscript,
        isUpdating: false,
      });
    } catch (error: any) {
      set({
        isUpdating: false,
        error: error.message || 'Failed to update transcript',
      });
      throw error;
    }
  },

  deleteTranscript: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await apiClient.deleteTranscript(id);
      const { transcripts } = get();
      set({
        transcripts: transcripts.filter(t => t.id !== id),
        currentTranscript: get().currentTranscript?.id === id ? null : get().currentTranscript,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.message || 'Failed to delete transcript',
      });
      throw error;
    }
  },

  fetchTranscript: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const transcript = await apiClient.getTranscript(id);
      set({
        currentTranscript: transcript,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.message || 'Failed to fetch transcript',
      });
      throw error;
    }
  },

  retryTranscription: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      // Assuming there's a retry endpoint in the API
      await fetch(`/api/transcripts/${id}/retry`, { method: 'POST' });
      const { transcripts } = get();
      set({
        transcripts: transcripts.map(t => 
          t.id === id ? { ...t, status: 'QUEUED' as const } : t
        ),
        isLoading: false,
      });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.message || 'Failed to retry transcription',
      });
      throw error;
    }
  },

  clearCurrentTranscript: () => {
    set({ currentTranscript: null });
  },

  clearError: () => {
    set({ error: null });
  },

  subscribeToTranscript: (id: string) => {
    apiClient.subscribeToTranscript(id);
  },

  unsubscribeFromTranscript: (id: string) => {
    apiClient.unsubscribeFromTranscript(id);
  },
}));

// Set up WebSocket event listeners
apiClient.on('transcript:progress', (data: any) => {
  const { transcripts, currentTranscript } = useTranscriptStore.getState();
  const transcriptId = data.transcriptId;
  
  // Update transcript status
  useTranscriptStore.setState({
    transcripts: transcripts.map(t => 
      t.id === transcriptId 
        ? { ...t, status: 'PROCESSING' as const }
        : t
    ),
    currentTranscript: currentTranscript?.id === transcriptId
      ? { ...currentTranscript, status: 'PROCESSING' as const }
      : currentTranscript,
  });
});

apiClient.on('transcript:completed', (data: any) => {
  const { transcripts, currentTranscript } = useTranscriptStore.getState();
  const { transcriptId, transcript: updatedTranscript } = data;
  
  useTranscriptStore.setState({
    transcripts: transcripts.map(t => 
      t.id === transcriptId 
        ? { ...t, ...updatedTranscript, status: 'COMPLETED' as const }
        : t
    ),
    currentTranscript: currentTranscript?.id === transcriptId
      ? { ...currentTranscript, ...updatedTranscript, status: 'COMPLETED' as const }
      : currentTranscript,
  });
});

apiClient.on('transcript:error', (data: any) => {
  const { transcripts, currentTranscript } = useTranscriptStore.getState();
  const transcriptId = data.transcriptId;
  
  useTranscriptStore.setState({
    transcripts: transcripts.map(t => 
      t.id === transcriptId 
        ? { ...t, status: 'FAILED' as const }
        : t
    ),
    currentTranscript: currentTranscript?.id === transcriptId
      ? { ...currentTranscript, status: 'FAILED' as const }
      : currentTranscript,
    error: data.error || 'Transcription failed',
  });
});