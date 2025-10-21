// API Types and Interfaces
export interface User {
  id: string;
  email: string;
  name: string;
  subscriptionTier?: string;
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

export interface RegisterResponse {
  user?: User;
  tokens?: AuthTokens;
  requiresConfirmation?: boolean;
  message?: string;
}

export interface Transcript {
  id: string;
  title: string;
  duration: number;
  language: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  audioUrl: string | null;
  segments?: TranscriptSegment[]; // Optional - only populated when fetching individual transcript
  createdAt: string;
  updatedAt: string;
}

export interface TranscriptSegment {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  speakerId?: string;
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
  uploadId: string; // This is the transcript ID
  fileName: string;
  fileSize: number;
  status: string;
  transcriptId: string;
  audioUrl: string;
  validationWarning?: string;

  // Backwards compatibility
  id?: string;
  filename?: string;
  size?: number;
  mimetype?: string;
  url?: string;
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
  type: 'transcript_progress' | 'transcript_completed' | 'transcript_error' |
        'batch_job_progress' | 'batch_item_progress' | 'batch_item_completed' |
        'batch_item_error' | 'batch_job_completed' | 'batch_job_paused' | 'batch_job_resumed';
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

// Batch Processing Types
export type BatchJobStatus = 'DRAFT' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'ERROR';
export type BatchItemStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'ERROR' | 'CANCELLED';

export interface BatchJob {
  id: string;
  userId: string;
  name: string;
  status: BatchJobStatus;
  concurrency: number;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  estimatedTimeRemaining?: number; // seconds
  throughputMbps?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface BatchItem {
  id: string;
  batchJobId: string;
  transcriptId?: string | null;
  fileName: string;
  fileSize: number;
  duration: number; // seconds
  status: BatchItemStatus;
  progress: number; // 0-100
  errorMessage?: string | null;
  eta?: number | null; // seconds
  confidence?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface BatchJobWithItems extends BatchJob {
  items: BatchItem[];
}

export interface CreateBatchJobRequest {
  name: string;
  concurrency?: number;
}

export interface UpdateBatchJobRequest {
  name?: string;
  concurrency?: number;
}

export interface BatchProgressCallback {
  (itemId: string, progress: number, loaded: number, total: number): void;
}

export interface BatchJobProgress {
  jobId: string;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  processingItems: number;
  estimatedTimeRemaining?: number;
  throughputMbps?: number;
}