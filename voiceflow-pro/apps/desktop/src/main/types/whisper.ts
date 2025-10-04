export interface WhisperConfig {
  model: string;
  language?: string;
  task?: 'transcribe' | 'translate';
  temperature?: number;
  maxTokens?: number;
  wordTimestamps?: boolean;
  threads?: number;
}

export interface TranscriptionSegment {
  text: string;
  start: number; // seconds
  end: number; // seconds
  confidence?: number;
  speaker?: string;
}

export interface TranscriptionResult {
  text: string;
  segments: TranscriptionSegment[];
  language?: string;
  duration?: number;
  processingTime?: number;
  fileSizeMB?: number;
  model?: string;
}

export interface WatchRule {
  id: string;
  path: string;
  recursive: boolean;
  model: string;
  language?: string;
  priority: 'speed' | 'accuracy' | 'cost' | 'privacy';
  postProcess?: {
    webhook?: string;
    moveToFolder?: string;
    notify?: boolean;
    exportFormats?: string[];
  };
  enabled: boolean;
  createdAt: Date;
  lastTriggered?: Date;
}

export interface ProcessingJob {
  id: string;
  filePath: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  stage: string;
  startTime: number;
  endTime?: number;
  result?: TranscriptionResult;
  error?: string;
  config: WhisperConfig;
}