/**
 * Hybrid Transcription Service
 * Intelligent routing between OpenAI API, Local Whisper, and Docker Whisper
 */

import { WhisperServerService, WhisperOptions as LocalWhisperOptions } from './whisperServer';
import { WhisperDockerService, WhisperDockerOptions } from './whisperDocker';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export type TranscriptionMethod = 'openai' | 'whisper-local' | 'whisper-docker' | 'auto';
export type WhisperModel = 'tiny' | 'tiny.en' | 'base' | 'base.en' | 'small' | 'small.en' | 'medium' | 'medium.en';

export interface HybridTranscriptionRequest {
  filePath: string;
  method: TranscriptionMethod;
  options: TranscriptionOptions;
  priority?: 'speed' | 'accuracy' | 'cost' | 'privacy';
  fallbackEnabled?: boolean;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface TranscriptionOptions {
  model?: WhisperModel;
  language?: string;
  task?: 'transcribe' | 'translate';
  wordTimestamps?: boolean;
  temperature?: number;
  maxTokens?: number;
  threads?: number;
}

export interface TranscriptionResult {
  id: string;
  text: string;
  segments?: TranscriptionSegment[];
  language?: string;
  duration?: number;
  processingTime: number;
  method: TranscriptionMethod;
  model?: string;
  cost?: number;
  fallbackUsed?: boolean;
  metadata?: TranscriptionMetadata;
}

export interface TranscriptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  confidence?: number;
}

export interface TranscriptionMetadata {
  fileSize: number;
  fileDuration?: number;
  processingLocation: 'cloud' | 'local' | 'container';
  resourceUsage?: ResourceUsage;
  qualityScore?: number;
  errorCount?: number;
}

export interface ResourceUsage {
  cpuTime?: number;
  memoryUsed?: number;
  gpuUsed?: boolean;
  containerUsed?: string;
}

export interface ServiceHealth {
  openai: {
    available: boolean;
    responseTime?: number;
    rateLimit?: number;
  };
  whisperLocal: {
    available: boolean;
    binaryExists: boolean;
    modelsAvailable: string[];
    systemLoad?: number;
  };
  whisperDocker: {
    available: boolean;
    containerRunning: boolean;
    containerHealth?: string;
    modelsAvailable: string[];
  };
}

export interface MethodPerformance {
  method: TranscriptionMethod;
  averageTime: number;
  successRate: number;
  costPerMinute: number;
  qualityScore: number;
  lastUsed: Date;
  usageCount: number;
}

export class HybridTranscriptionService {
  private static instance: HybridTranscriptionService;
  
  private whisperLocal?: WhisperServerService;
  private whisperDocker?: WhisperDockerService;
  private performanceMetrics = new Map<TranscriptionMethod, MethodPerformance>();
  private config: HybridConfig;
  private lastOpenAiWarning = 0;
  
  private constructor(config?: Partial<HybridConfig>) {
    this.config = {
      openaiApiKey: config?.openaiApiKey || process.env.OPENAI_API_KEY || '',
      openaiEndpoint: config?.openaiEndpoint || 'https://api.openai.com/v1/audio/transcriptions',
      enableOpenAI: config?.enableOpenAI !== false,
      enableWhisperLocal: config?.enableWhisperLocal !== false,
      enableWhisperDocker: config?.enableWhisperDocker !== false,
      defaultMethod: config?.defaultMethod || 'auto',
      fallbackOrder: config?.fallbackOrder || ['whisper-local', 'whisper-docker', 'openai'],
      costOptimization: config?.costOptimization !== false,
      qualityThreshold: config?.qualityThreshold || 0.8,
      maxRetries: config?.maxRetries || 2,
      ...config
    };

    // Initialize services
    if (this.config.enableWhisperLocal) {
      this.whisperLocal = new WhisperServerService(config?.localWhisperConfig);
    }
    
    if (this.config.enableWhisperDocker) {
      this.whisperDocker = new WhisperDockerService(config?.dockerWhisperConfig);
    }

    // Initialize performance metrics
    this.initializeMetrics();
  }

  static getInstance(config?: Partial<HybridConfig>): HybridTranscriptionService {
    if (!HybridTranscriptionService.instance) {
      HybridTranscriptionService.instance = new HybridTranscriptionService(config);
    }
    return HybridTranscriptionService.instance;
  }

  /**
   * Main transcription method with intelligent routing
   */
  async transcribe(request: HybridTranscriptionRequest): Promise<TranscriptionResult> {
    const startTime = Date.now();
    const transcriptionId = uuidv4();
    
    console.log(`🎙️ Starting transcription ${transcriptionId} with method: ${request.method}`);
    
    // Get file metadata
    const fileStats = await fs.stat(request.filePath);
    const fileSize = fileStats.size;
    
    // Determine optimal method
    const optimalMethod = await this.selectOptimalMethod(request, fileSize);
    console.log(`🎯 Selected optimal method: ${optimalMethod}`);
    
    // Prepare fallback methods if enabled
    const methods = request.fallbackEnabled !== false
      ? this.getMethodsInOrder(optimalMethod, request.priority)
      : [optimalMethod];
    
    let lastError: Error | null = null;
    let fallbackUsed = false;
    
    for (const [index, method] of methods.entries()) {
      if (index > 0) {
        fallbackUsed = true;
        console.log(`🔄 Attempting fallback method: ${method}`);
      }
      
      try {
        const result = await this.transcribeWithMethod(
          method,
          request.filePath,
          request.options,
          transcriptionId
        );
        
        // Calculate cost
        const cost = this.calculateCost(method, fileSize, result.processingTime);
        
        // Record metrics
        this.recordMethodPerformance(method, result.processingTime, true, cost);
        
        // Build final result
        const finalResult: TranscriptionResult = {
          id: transcriptionId,
          text: result.text,
          segments: result.segments,
          language: result.language,
          duration: result.duration,
          processingTime: Date.now() - startTime,
          method,
          model: result.model,
          cost,
          fallbackUsed,
          metadata: {
            fileSize,
            processingLocation: this.getProcessingLocation(method),
            resourceUsage: result.resourceUsage,
            qualityScore: this.calculateQualityScore(result),
            errorCount: index // Number of failed attempts before success
          }
        };
        
        console.log(`✅ Transcription ${transcriptionId} completed successfully with ${method}`);
        return finalResult;
        
      } catch (error: any) {
        console.error(`❌ Method ${method} failed for transcription ${transcriptionId}:`, error.message);
        
        // Record failure metrics
        this.recordMethodPerformance(method, Date.now() - startTime, false, 0);
        
        lastError = error;
        
        // Check if we should try fallback
        if (index === methods.length - 1 || !request.fallbackEnabled) {
          break;
        }
      }
    }
    
    // All methods failed
    console.error(`💥 All transcription methods failed for ${transcriptionId}`);
    throw new Error(`Transcription failed: ${lastError?.message || 'All methods failed'}`);
  }

  /**
   * Get service health status
   */
  async getServiceHealth(): Promise<ServiceHealth> {
    const health: ServiceHealth = {
      openai: { available: false },
      whisperLocal: { available: false, binaryExists: false, modelsAvailable: [] },
      whisperDocker: { available: false, containerRunning: false, modelsAvailable: [] }
    };

    // Check OpenAI availability
    if (this.config.enableOpenAI && this.config.openaiApiKey) {
      try {
        // Test OpenAI API with a quick request (you'd implement this)
        health.openai.available = true;
        health.openai.responseTime = await this.pingOpenAI();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const now = Date.now();
        if (now - this.lastOpenAiWarning > 60_000) {
          console.warn(`OpenAI API unreachable (${message}). Continuing with local/Docker whisper only.`);
          this.lastOpenAiWarning = now;
        }
      }
    }

    // Check local Whisper
    if (this.config.enableWhisperLocal && this.whisperLocal) {
      try {
        const localHealth = await this.whisperLocal.getHealthStatus();
        health.whisperLocal = {
          available: localHealth.status === 'healthy',
          binaryExists: localHealth.whisperBinary,
          modelsAvailable: localHealth.availableModels,
          systemLoad: this.getSystemLoad()
        };
      } catch (error) {
        console.warn('Local Whisper not available:', error);
      }
    }

    // Check Docker Whisper
    if (this.config.enableWhisperDocker && this.whisperDocker) {
      try {
        const dockerHealth = await this.whisperDocker.getHealthStatus();
        health.whisperDocker = {
          available: dockerHealth.status === 'healthy',
          containerRunning: dockerHealth.containerRunning,
          containerHealth: dockerHealth.status,
          modelsAvailable: dockerHealth.availableModels
        };
      } catch (error) {
        console.warn('Docker Whisper not available:', error);
      }
    }

    return health;
  }

  getLocalService(): WhisperServerService | null {
    return this.whisperLocal ?? null;
  }

  getDockerService(): WhisperDockerService | null {
    return this.whisperDocker ?? null;
  }

  /**
   * Get performance metrics for all methods
   */
  getPerformanceMetrics(): MethodPerformance[] {
    return Array.from(this.performanceMetrics.values());
  }

  /**
   * Select optimal transcription method based on request and system state
   */
  private async selectOptimalMethod(
    request: HybridTranscriptionRequest,
    fileSize: number
  ): Promise<TranscriptionMethod> {
    // If method is explicitly specified (not auto), use it
    if (request.method !== 'auto') {
      return request.method;
    }

    // Get service health
    const health = await this.getServiceHealth();
    const availableMethods = this.getAvailableMethods(health);
    
    if (availableMethods.length === 0) {
      throw new Error('No transcription methods are currently available');
    }

    // Priority-based selection
    switch (request.priority) {
      case 'speed':
        return this.selectForSpeed(availableMethods, fileSize);
      
      case 'accuracy':
        return this.selectForAccuracy(availableMethods);
      
      case 'cost':
        return this.selectForCost(availableMethods, fileSize);
      
      case 'privacy':
        return this.selectForPrivacy(availableMethods);
      
      default:
        return this.selectBalanced(availableMethods, fileSize);
    }
  }

  /**
   * Transcribe with a specific method
   */
  private async transcribeWithMethod(
    method: TranscriptionMethod,
    filePath: string,
    options: TranscriptionOptions,
    transcriptionId: string
  ): Promise<any> {
    switch (method) {
      case 'openai':
        return await this.transcribeWithOpenAI(filePath, options);
      
      case 'whisper-local':
        if (!this.whisperLocal) {
          throw new Error('Local Whisper service not initialized');
        }
        return await this.whisperLocal.transcribeFile(filePath, options);
      
      case 'whisper-docker':
        if (!this.whisperDocker) {
          throw new Error('Docker Whisper service not initialized');
        }
        return await this.whisperDocker.transcribeFile(filePath, options);
      
      default:
        throw new Error(`Unknown transcription method: ${method}`);
    }
  }

  /**
   * Transcribe with OpenAI API
   */
  private async transcribeWithOpenAI(
    filePath: string,
    options: TranscriptionOptions
  ): Promise<any> {
    const FormData = require('form-data');
    const axios = require('axios');
    
    const formData = new FormData();
    formData.append('file', require('fs').createReadStream(filePath));
    formData.append('model', 'whisper-1');
    
    if (options.language) {
      formData.append('language', options.language);
    }
    
    if (options.task) {
      formData.append('response_format', 'verbose_json');
    }

    const response = await axios.post(this.config.openaiEndpoint, formData, {
      headers: {
        'Authorization': `Bearer ${this.config.openaiApiKey}`,
        ...formData.getHeaders()
      }
    });

    return {
      text: response.data.text,
      segments: response.data.segments,
      language: response.data.language,
      duration: response.data.duration,
      model: 'whisper-1',
      method: 'openai'
    };
  }

  /**
   * Get available methods based on health status
   */
  private getAvailableMethods(health: ServiceHealth): TranscriptionMethod[] {
    const available: TranscriptionMethod[] = [];
    
    if (health.openai.available) {
      available.push('openai');
    }
    
    if (health.whisperLocal.available) {
      available.push('whisper-local');
    }
    
    if (health.whisperDocker.available) {
      available.push('whisper-docker');
    }
    
    return available;
  }

  /**
   * Get methods in optimal order for fallback
   */
  private getMethodsInOrder(
    primaryMethod: TranscriptionMethod,
    priority?: string
  ): TranscriptionMethod[] {
    const methods = [primaryMethod];
    
    // Add fallback methods based on configuration
    for (const fallback of this.config.fallbackOrder) {
      if (!methods.includes(fallback)) {
        methods.push(fallback);
      }
    }
    
    return methods;
  }

  /**
   * Selection strategies for different priorities
   */
  private selectForSpeed(methods: TranscriptionMethod[], fileSize: number): TranscriptionMethod {
    // For small files, local processing is usually faster
    if (fileSize < 10 * 1024 * 1024 && methods.includes('whisper-local')) { // < 10MB
      return 'whisper-local';
    }
    
    // For larger files, prefer Docker or OpenAI
    if (methods.includes('whisper-docker')) {
      return 'whisper-docker';
    }
    
    return methods.includes('openai') ? 'openai' : methods[0];
  }

  private selectForAccuracy(methods: TranscriptionMethod[]): TranscriptionMethod {
    // OpenAI generally has the highest accuracy
    if (methods.includes('openai')) {
      return 'openai';
    }
    
    // Local Whisper with larger models
    return methods.includes('whisper-local') ? 'whisper-local' : methods[0];
  }

  private selectForCost(methods: TranscriptionMethod[], fileSize: number): TranscriptionMethod {
    // Local processing is free after setup
    if (methods.includes('whisper-local')) {
      return 'whisper-local';
    }
    
    if (methods.includes('whisper-docker')) {
      return 'whisper-docker';
    }
    
    return methods[0];
  }

  private selectForPrivacy(methods: TranscriptionMethod[]): TranscriptionMethod {
    // Local processing keeps data private
    if (methods.includes('whisper-local')) {
      return 'whisper-local';
    }
    
    if (methods.includes('whisper-docker')) {
      return 'whisper-docker';
    }
    
    return methods[0];
  }

  private selectBalanced(methods: TranscriptionMethod[], fileSize: number): TranscriptionMethod {
    // Use performance metrics to select best balanced option
    const metrics = this.getPerformanceMetrics();
    
    if (metrics.length === 0) {
      // No metrics yet, use default logic
      return this.selectForSpeed(methods, fileSize);
    }
    
    // Calculate score based on speed, success rate, and cost
    let bestMethod = methods[0];
    let bestScore = 0;
    
    for (const method of methods) {
      const metric = metrics.find(m => m.method === method);
      if (metric) {
        const score = (
          (1000 / Math.max(metric.averageTime, 1)) * 0.3 + // Speed (inverted)
          metric.successRate * 0.4 + // Reliability
          (100 / Math.max(metric.costPerMinute, 0.01)) * 0.2 + // Cost (inverted)
          metric.qualityScore * 0.1 // Quality
        );
        
        if (score > bestScore) {
          bestScore = score;
          bestMethod = method;
        }
      }
    }
    
    return bestMethod;
  }

  /**
   * Calculate transcription cost based on method and usage
   */
  private calculateCost(method: TranscriptionMethod, fileSize: number, processingTime: number): number {
    const fileDurationMinutes = this.estimateFileDuration(fileSize) / 60;
    
    switch (method) {
      case 'openai':
        return fileDurationMinutes * 0.006; // $0.006 per minute
      
      case 'whisper-local':
        return 0; // Free after setup (excluding electricity/hardware costs)
      
      case 'whisper-docker':
        return fileDurationMinutes * 0.001; // Minimal cost for compute resources
      
      default:
        return 0;
    }
  }

  /**
   * Calculate quality score based on transcription result
   */
  private calculateQualityScore(result: any): number {
    // This is a simplified quality assessment
    // In practice, you might use confidence scores, error rates, etc.
    
    let score = 0.8; // Base score
    
    // Adjust based on segments confidence if available
    if (result.segments && result.segments.length > 0) {
      const avgConfidence = result.segments.reduce((sum: number, seg: any) => {
        return sum + (seg.confidence || 0.8);
      }, 0) / result.segments.length;
      
      score = avgConfidence;
    }
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Get processing location for a method
   */
  private getProcessingLocation(method: TranscriptionMethod): 'cloud' | 'local' | 'container' {
    switch (method) {
      case 'openai':
        return 'cloud';
      case 'whisper-local':
        return 'local';
      case 'whisper-docker':
        return 'container';
      default:
        return 'local';
    }
  }

  /**
   * Record method performance metrics
   */
  private recordMethodPerformance(
    method: TranscriptionMethod,
    processingTime: number,
    success: boolean,
    cost: number
  ): void {
    const existing = this.performanceMetrics.get(method);
    
    if (existing) {
      // Update existing metrics
      existing.averageTime = (existing.averageTime * existing.usageCount + processingTime) / (existing.usageCount + 1);
      existing.successRate = (existing.successRate * existing.usageCount + (success ? 1 : 0)) / (existing.usageCount + 1);
      existing.costPerMinute = (existing.costPerMinute * existing.usageCount + cost) / (existing.usageCount + 1);
      existing.usageCount++;
      existing.lastUsed = new Date();
    } else {
      // Create new metrics
      this.performanceMetrics.set(method, {
        method,
        averageTime: processingTime,
        successRate: success ? 1 : 0,
        costPerMinute: cost,
        qualityScore: 0.8, // Default
        lastUsed: new Date(),
        usageCount: 1
      });
    }
  }

  /**
   * Initialize default performance metrics
   */
  private initializeMetrics(): void {
    const defaultMethods: TranscriptionMethod[] = ['openai', 'whisper-local', 'whisper-docker'];
    
    for (const method of defaultMethods) {
      this.performanceMetrics.set(method, {
        method,
        averageTime: 10000, // 10 seconds default
        successRate: 0.95, // 95% default success rate
        costPerMinute: method === 'openai' ? 0.006 : 0,
        qualityScore: 0.8,
        lastUsed: new Date(),
        usageCount: 0
      });
    }
  }

  /**
   * Estimate file duration from file size (rough approximation)
   */
  private estimateFileDuration(fileSize: number): number {
    // Very rough estimation: 1MB ≈ 60 seconds for compressed audio
    return (fileSize / (1024 * 1024)) * 60;
  }

  /**
   * Get system load (simplified)
   */
  private getSystemLoad(): number {
    const os = require('os');
    const loadAvg = os.loadavg();
    return loadAvg[0] / os.cpus().length;
  }

  /**
   * Ping OpenAI API to check availability
   */
  private async pingOpenAI(): Promise<number> {
    const startTime = Date.now();
    
    try {
      const axios = require('axios');
      await axios.get('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.config.openaiApiKey}`
        },
        timeout: 5000
      });
      
      return Date.now() - startTime;
    } catch (error) {
      throw new Error('OpenAI API not accessible');
    }
  }
}

interface HybridConfig {
  openaiApiKey: string;
  openaiEndpoint: string;
  enableOpenAI: boolean;
  enableWhisperLocal: boolean;
  enableWhisperDocker: boolean;
  defaultMethod: TranscriptionMethod;
  fallbackOrder: TranscriptionMethod[];
  costOptimization: boolean;
  qualityThreshold: number;
  maxRetries: number;
  localWhisperConfig?: any;
  dockerWhisperConfig?: any;
}