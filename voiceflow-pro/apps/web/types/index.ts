export * from '@voiceflow-pro/shared';

export interface UploadProgress {
  uploadId: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
}

export interface AudioPlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
}

export interface TranscriptViewMode {
  mode: 'segments' | 'paragraphs' | 'speaker';
  showTimestamps: boolean;
  showSpeakers: boolean;
  showConfidence: boolean;
}

export interface FileUploadOptions {
  maxSize: number;
  acceptedTypes: string[];
  multiple: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginationResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}