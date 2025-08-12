/**
 * Transcription Router
 * Handles routing between OpenAI API and Whisper with fallback mechanisms
 */

import { WhisperWebEngine, WhisperConfig, TranscriptionResult } from './whisperEngine';
import { WhisperModelManager, WhisperModel } from './modelManager';
import { WhisperWorkerManager } from './whisperWorker';

export type TranscriptionMethod = 'openai' | 'whisper-browser' | 'whisper-server';

export interface TranscriptionRequest {
  method: TranscriptionMethod;
  audio: File | Float32Array;
  config?: Partial<WhisperConfig>;
  priority?: 'speed' | 'accuracy' | 'cost';
  fallbackEnabled?: boolean;
}

export interface TranscriptionMetrics {
  method: TranscriptionMethod;
  success: boolean;
  duration: number;
  modelUsed?: string;
  fallbackUsed?: boolean;
  error?: string;
}

// Error types for better handling
export class TranscriptionError extends Error {
  constructor(
    message: string,
    public code: string,
    public method: TranscriptionMethod,
    public canFallback: boolean = true
  ) {
    super(message);
    this.name = 'TranscriptionError';
  }
}

/**
 * TranscriptionRouter
 * Main class for handling transcription with multiple methods and fallbacks
 */
export class TranscriptionRouter {
  private static instance: TranscriptionRouter;
  private whisperEngine: WhisperWebEngine | null = null;
  private workerManager: WhisperWorkerManager | null = null;
  private modelManager: WhisperModelManager;
  private metrics: TranscriptionMetrics[] = [];
  private preferredMethod: TranscriptionMethod = 'whisper-browser';
  
  private constructor() {
    this.modelManager = WhisperModelManager.getInstance();
  }

  static getInstance(): TranscriptionRouter {
    if (!TranscriptionRouter.instance) {
      TranscriptionRouter.instance = new TranscriptionRouter();
    }
    return TranscriptionRouter.instance;
  }

  /**
   * Set the preferred transcription method
   */
  setPreferredMethod(method: TranscriptionMethod): void {
    this.preferredMethod = method;
    console.log(`Preferred transcription method set to: ${method}`);
  }

  /**
   * Main transcription method with automatic fallback
   */
  async transcribe(request: TranscriptionRequest): Promise<TranscriptionResult> {
    const startTime = performance.now();
    const methods = this.getMethodOrder(request);
    
    let lastError: Error | null = null;
    let fallbackUsed = false;

    for (const method of methods) {
      try {
        console.log(`Attempting transcription with method: ${method}`);
        
        const result = await this.transcribeWithMethod(method, request);
        
        // Record success metrics
        this.recordMetrics({
          method,
          success: true,
          duration: performance.now() - startTime,
          modelUsed: request.config?.model,
          fallbackUsed,
        });

        return result;
      } catch (error: any) {
        console.error(`Transcription failed with ${method}:`, error);
        lastError = error;
        fallbackUsed = true;

        // Record failure metrics
        this.recordMetrics({
          method,
          success: false,
          duration: performance.now() - startTime,
          error: error.message,
          fallbackUsed: false,
        });

        // Check if we should try fallback
        if (!request.fallbackEnabled) {
          throw error;
        }

        if (error instanceof TranscriptionError && !error.canFallback) {
          throw error;
        }
      }
    }

    // All methods failed
    throw new TranscriptionError(
      'All transcription methods failed',
      'ALL_METHODS_FAILED',
      request.method,
      false
    );
  }

  /**
   * Transcribe with a specific method
   */
  private async transcribeWithMethod(
    method: TranscriptionMethod,
    request: TranscriptionRequest
  ): Promise<TranscriptionResult> {
    switch (method) {
      case 'openai':
        return await this.transcribeWithOpenAI(request);
      
      case 'whisper-browser':
        return await this.transcribeWithWhisperBrowser(request);
      
      case 'whisper-server':
        return await this.transcribeWithWhisperServer(request);
      
      default:
        throw new Error(`Unknown transcription method: ${method}`);
    }
  }

  /**
   * Transcribe using OpenAI API
   */
  private async transcribeWithOpenAI(request: TranscriptionRequest): Promise<TranscriptionResult> {
    // Get the audio as File
    let file: File;
    if (request.audio instanceof File) {
      file = request.audio;
    } else {
      // Convert Float32Array to File
      const blob = new Blob([request.audio.buffer], { type: 'audio/wav' });
      file = new File([blob], 'audio.wav', { type: 'audio/wav' });
    }

    // Call OpenAI API (using existing implementation)
    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', 'whisper-1');
    
    if (request.config?.language) {
      formData.append('language', request.config.language);
    }

    const response = await fetch('/api/transcriptions/openai', {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new TranscriptionError(
        error.message || 'OpenAI API error',
        'OPENAI_API_ERROR',
        'openai',
        true
      );
    }

    const result = await response.json();
    return result;
  }

  /**
   * Transcribe using Whisper in browser
   */
  private async transcribeWithWhisperBrowser(
    request: TranscriptionRequest
  ): Promise<TranscriptionResult> {
    // Initialize Whisper engine if needed
    if (!this.whisperEngine) {
      this.whisperEngine = new WhisperWebEngine();
    }

    // Determine which model to use
    const model = request.config?.model || this.getOptimalModel(request);

    // Check if model is available
    const hasModel = await this.modelManager.getCachedModel(model);
    if (!hasModel && !navigator.onLine) {
      throw new TranscriptionError(
        'Model not available offline',
        'MODEL_NOT_CACHED',
        'whisper-browser',
        true
      );
    }

    // Initialize with model
    await this.whisperEngine.initialize({
      model,
      ...request.config,
    });

    // Use worker for better performance
    if (!this.workerManager) {
      this.workerManager = new WhisperWorkerManager();
      const modelBuffer = await this.modelManager.getCachedModel(model);
      if (modelBuffer) {
        await this.workerManager.initialize(model, modelBuffer);
      }
    }

    // Transcribe
    let audioData: Float32Array;
    if (request.audio instanceof File) {
      audioData = await this.fileToFloat32Array(request.audio);
    } else {
      audioData = request.audio;
    }

    try {
      // Try with worker first
      if (this.workerManager) {
        const status = await this.workerManager.getStatus();
        if (status.initialized && !status.isProcessing) {
          return await this.workerManager.transcribe(audioData, request.config);
        }
      }

      // Fallback to main thread
      return await this.whisperEngine.transcribeAudio(audioData, request.config);
    } catch (error: any) {
      throw new TranscriptionError(
        error.message,
        'WHISPER_BROWSER_ERROR',
        'whisper-browser',
        true
      );
    }
  }

  /**
   * Transcribe using Whisper on server
   */
  private async transcribeWithWhisperServer(
    request: TranscriptionRequest
  ): Promise<TranscriptionResult> {
    // Convert audio to File if needed
    let file: File;
    if (request.audio instanceof File) {
      file = request.audio;
    } else {
      const blob = new Blob([request.audio.buffer], { type: 'audio/wav' });
      file = new File([blob], 'audio.wav', { type: 'audio/wav' });
    }

    // Upload to server
    const formData = new FormData();
    formData.append('file', file);
    formData.append('method', 'whisper');
    
    if (request.config?.model) {
      formData.append('model', request.config.model);
    }
    if (request.config?.language) {
      formData.append('language', request.config.language);
    }

    const response = await fetch('/api/transcriptions/whisper', {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new TranscriptionError(
        error.message || 'Server Whisper error',
        'WHISPER_SERVER_ERROR',
        'whisper-server',
        true
      );
    }

    return await response.json();
  }

  /**
   * Determine the order of methods to try
   */
  private getMethodOrder(request: TranscriptionRequest): TranscriptionMethod[] {
    const methods: TranscriptionMethod[] = [];

    // Start with requested method
    methods.push(request.method);

    // Add fallbacks based on priority
    if (request.priority === 'speed') {
      if (!methods.includes('whisper-browser')) methods.push('whisper-browser');
      if (!methods.includes('whisper-server')) methods.push('whisper-server');
      if (!methods.includes('openai')) methods.push('openai');
    } else if (request.priority === 'accuracy') {
      if (!methods.includes('openai')) methods.push('openai');
      if (!methods.includes('whisper-server')) methods.push('whisper-server');
      if (!methods.includes('whisper-browser')) methods.push('whisper-browser');
    } else if (request.priority === 'cost') {
      if (!methods.includes('whisper-browser')) methods.push('whisper-browser');
      if (!methods.includes('whisper-server')) methods.push('whisper-server');
      if (!methods.includes('openai')) methods.push('openai');
    } else {
      // Default order
      if (!methods.includes(this.preferredMethod)) methods.push(this.preferredMethod);
      if (!methods.includes('whisper-browser')) methods.push('whisper-browser');
      if (!methods.includes('openai')) methods.push('openai');
      if (!methods.includes('whisper-server')) methods.push('whisper-server');
    }

    return methods;
  }

  /**
   * Get optimal model based on request and device capabilities
   */
  private getOptimalModel(request: TranscriptionRequest): WhisperModel {
    // Check if a specific model is requested
    if (request.config?.model) {
      return request.config.model;
    }

    // Get recommendation based on device
    return this.modelManager.getRecommendedModel();
  }

  /**
   * Convert File to Float32Array
   */
  private async fileToFloat32Array(file: File): Promise<Float32Array> {
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new AudioContext({ sampleRate: 16000 });
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Get mono channel
    return audioBuffer.getChannelData(0);
  }

  /**
   * Record metrics for analysis
   */
  private recordMetrics(metrics: TranscriptionMetrics): void {
    this.metrics.push(metrics);
    
    // Keep only last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }

    // Log to analytics service
    this.logToAnalytics(metrics);
  }

  /**
   * Log metrics to analytics service
   */
  private logToAnalytics(metrics: TranscriptionMetrics): void {
    // In production, send to analytics service
    if (typeof window !== 'undefined' && (window as any).analytics) {
      (window as any).analytics.track('transcription_complete', {
        method: metrics.method,
        success: metrics.success,
        duration: metrics.duration,
        modelUsed: metrics.modelUsed,
        fallbackUsed: metrics.fallbackUsed,
        error: metrics.error,
      });
    }
  }

  /**
   * Get transcription metrics
   */
  getMetrics(): {
    total: number;
    byMethod: Record<TranscriptionMethod, {
      count: number;
      successRate: number;
      averageDuration: number;
    }>;
    fallbackRate: number;
  } {
    const byMethod: Record<string, any> = {};
    
    for (const method of ['openai', 'whisper-browser', 'whisper-server']) {
      const methodMetrics = this.metrics.filter(m => m.method === method);
      const successful = methodMetrics.filter(m => m.success);
      
      byMethod[method] = {
        count: methodMetrics.length,
        successRate: methodMetrics.length > 0 ? successful.length / methodMetrics.length : 0,
        averageDuration: successful.length > 0 
          ? successful.reduce((sum, m) => sum + m.duration, 0) / successful.length 
          : 0,
      };
    }

    const fallbacks = this.metrics.filter(m => m.fallbackUsed);

    return {
      total: this.metrics.length,
      byMethod: byMethod as any,
      fallbackRate: this.metrics.length > 0 ? fallbacks.length / this.metrics.length : 0,
    };
  }

  /**
   * Preload models for better performance
   */
  async preloadModels(models: WhisperModel[]): Promise<void> {
    await this.modelManager.preloadModels(models);
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    if (this.whisperEngine) {
      await this.whisperEngine.destroy();
      this.whisperEngine = null;
    }

    if (this.workerManager) {
      await this.workerManager.destroy();
      this.workerManager = null;
    }
  }
}