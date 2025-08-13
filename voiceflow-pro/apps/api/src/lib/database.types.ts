// Database types for VoiceFlow Pro with Whisper integration
// This reflects the Prisma schema with server-side processing support

export type TranscriptionMethod = 'OPENAI' | 'WHISPER_LOCAL' | 'WHISPER_DOCKER';
export type ProcessingLocation = 'CLOUD' | 'LOCAL' | 'CONTAINER';
export type TranscriptStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type SubscriptionTier = 'FREE' | 'PRO' | 'ENTERPRISE';
export type AccessLevel = 'READ' | 'COMMENT' | 'EDIT';

export interface ProcessingStats {
  processingTime?: number;
  cost?: number;
  qualityScore?: number;
  resourceUsage?: {
    cpuTime?: number;
    memoryUsed?: number;
    gpuUsed?: boolean;
    containerUsed?: string;
  };
  errorCount?: number;
  fallbackUsed?: boolean;
}

export type Database = {
  public: {
    Tables: {
      User: {
        Row: {
          id: string;
          email: string;
          name: string;
          subscriptionTier: SubscriptionTier;
          createdAt: string;
          updatedAt: string;
          deletedAt: string | null;
        };
        Insert: Omit<Database['public']['Tables']['User']['Row'], 'id' | 'createdAt' | 'updatedAt'>;
        Update: Partial<Database['public']['Tables']['User']['Insert']>;
      };
      Transcript: {
        Row: {
          id: string;
          userId: string;
          title: string;
          duration: number;
          language: string;
          status: TranscriptStatus;
          audioUrl: string | null;
          transcriptionMethod: TranscriptionMethod;
          whisperModel: string | null;
          processingLocation: ProcessingLocation;
          processingStats: ProcessingStats | null;
          createdAt: string;
          updatedAt: string;
          deletedAt: string | null;
        };
        Insert: Omit<Database['public']['Tables']['Transcript']['Row'], 'id' | 'createdAt' | 'updatedAt'>;
        Update: Partial<Database['public']['Tables']['Transcript']['Insert']>;
      };
      TranscriptSegment: {
        Row: {
          id: string;
          transcriptId: string;
          startTime: number;
          endTime: number;
          text: string;
          speakerId: string | null;
          confidence: number;
          createdAt: string;
          updatedAt: string;
        };
        Insert: Omit<Database['public']['Tables']['TranscriptSegment']['Row'], 'id' | 'createdAt' | 'updatedAt'>;
        Update: Partial<Database['public']['Tables']['TranscriptSegment']['Insert']>;
      };
      TranscriptComment: {
        Row: {
          id: string;
          transcriptId: string;
          userId: string;
          segmentId: string | null;
          content: string;
          timestampPosition: number | null;
          createdAt: string;
          updatedAt: string;
          deletedAt: string | null;
        };
        Insert: Omit<Database['public']['Tables']['TranscriptComment']['Row'], 'id' | 'createdAt' | 'updatedAt'>;
        Update: Partial<Database['public']['Tables']['TranscriptComment']['Insert']>;
      };
      TranscriptShare: {
        Row: {
          id: string;
          transcriptId: string;
          sharedById: string;
          sharedWithId: string | null;
          accessLevel: AccessLevel;
          shareToken: string | null;
          expiresAt: string | null;
          createdAt: string;
          updatedAt: string;
        };
        Insert: Omit<Database['public']['Tables']['TranscriptShare']['Row'], 'id' | 'createdAt' | 'updatedAt'>;
        Update: Partial<Database['public']['Tables']['TranscriptShare']['Insert']>;
      };
      UserPreferences: {
        Row: {
          id: string;
          userId: string;
          defaultTranscriptionMethod: TranscriptionMethod;
          defaultWhisperModel: string;
          autoDownloadModels: boolean;
          privacyMode: boolean;
          preferredProcessingLocation: ProcessingLocation;
          maxFileSize: number;
          createdAt: string;
          updatedAt: string;
        };
        Insert: Omit<Database['public']['Tables']['UserPreferences']['Row'], 'id' | 'createdAt' | 'updatedAt'>;
        Update: Partial<Database['public']['Tables']['UserPreferences']['Insert']>;
      };
    };
  };
};