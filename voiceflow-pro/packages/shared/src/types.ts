export enum TranscriptStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum SubscriptionTier {
  FREE = 'FREE',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

export enum AccessLevel {
  READ = 'READ',
  COMMENT = 'COMMENT',
  EDIT = 'EDIT',
}

export interface User {
  id: string
  email: string
  name: string
  subscriptionTier: SubscriptionTier
  createdAt: Date
  updatedAt: Date
}

export interface Transcript {
  id: string
  userId: string
  title: string
  duration: number
  language: string
  status: TranscriptStatus
  audioUrl: string
  createdAt: Date
  updatedAt: Date
}

export interface TranscriptSegment {
  id: string
  transcriptId: string
  startTime: number
  endTime: number
  text: string
  speakerId?: string
  confidence: number
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
}