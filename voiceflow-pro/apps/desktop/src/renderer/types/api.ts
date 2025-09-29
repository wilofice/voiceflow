// API Types and Interfaces
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

export interface Transcript {
  id: string;
  title: string;
  duration: number;
  language: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  audioUrl: string | null;
  segments: TranscriptSegment[];
  createdAt: string;
  updatedAt: string;
}

export interface TranscriptSegment {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  speaker?: string;
  confidence?: number;
}

export interface CreateTranscriptRequest {
  uploadId: string;
  title?: string;
  language?: string;
}

export interface UpdateTranscriptRequest {
  title?: string;
  segments?: Array<{
    id: string;
    text: string;
  }>;
}

export interface UploadMetadata {
  title?: string;
  language?: string;
}

export interface UploadResponse {
  id: string;
  filename: string;
  size: number;
  mimetype: string;
  url: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface APIError {
  code: string;
  message: string;
  details?: any;
}

export interface ProgressCallback {
  (progress: number, loaded: number, total: number): void;
}

export interface RequestConfig {
  timeout?: number;
  retries?: number;
  onProgress?: ProgressCallback;
}

export interface WebSocketMessage {
  type: 'transcript_progress' | 'transcript_completed' | 'transcript_error';
  data: any;
  timestamp: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  size: string;
  downloaded: boolean;
  downloadProgress?: number;
}