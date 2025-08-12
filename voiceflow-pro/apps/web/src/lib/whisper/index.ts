/**
 * Whisper Module Exports
 * Central export point for all Whisper-related functionality
 */

// Core components
export { WhisperWebEngine } from './whisperEngine';
export type { WhisperConfig, TranscriptionResult, TranscriptionSegment } from './whisperEngine';

// Model management
export { WhisperModelManager } from './modelManager';
export type { WhisperModel, ModelInfo, StorageInfo, DownloadProgress } from './modelManager';

// Worker management
export { WhisperWorkerManager, createWorkerFile } from './whisperWorker';
export type { WorkerMessage, WorkerResponse } from './whisperWorker';

// Transcription routing
export { TranscriptionRouter, TranscriptionError } from './transcriptionRouter';
export type { TranscriptionMethod, TranscriptionRequest, TranscriptionMetrics } from './transcriptionRouter';

// Security
export { SecurityValidator, RateLimiter } from './security';
export type { FileValidationResult, SecurityConfig } from './security';

// Analytics
export { WhisperAnalytics, trackWhisperEvent, logWhisperError } from './analytics';
export type { AnalyticsEvent, ErrorLog, PerformanceMetric } from './analytics';

// Utility functions
export { checkBrowserCompatibility, formatFileSize } from './utils';

// Default exports for common use cases
export default {
  /**
   * Initialize Whisper with default settings
   */
  async initialize(model: WhisperModel = 'base'): Promise<WhisperWebEngine> {
    const engine = new WhisperWebEngine();
    await engine.initialize({ model });
    return engine;
  },

  /**
   * Get the transcription router instance
   */
  getRouter(): TranscriptionRouter {
    return TranscriptionRouter.getInstance();
  },

  /**
   * Get the model manager instance
   */
  getModelManager(): WhisperModelManager {
    return WhisperModelManager.getInstance();
  },

  /**
   * Get analytics instance
   */
  getAnalytics(): WhisperAnalytics {
    return WhisperAnalytics.getInstance();
  },

  /**
   * Check if Whisper is supported in current browser
   */
  isSupported(): boolean {
    const validator = SecurityValidator;
    const compatibility = validator.checkBrowserCompatibility();
    return compatibility.compatible;
  },

  /**
   * Get content security policy for Whisper
   */
  getCSP(): string {
    return SecurityValidator.getContentSecurityPolicy();
  },
};