/**
 * Whisper Server Service
 * Handles local whisper.cpp processing for server-side transcription
 */

import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

export interface WhisperOptions {
  model?: WhisperModel;
  language?: string;
  task?: 'transcribe' | 'translate';
  threads?: number;
  outputFormat?: 'txt' | 'vtt' | 'srt' | 'json';
  wordTimestamps?: boolean;
  temperature?: number;
  maxTokens?: number;
  noSpeech?: number;
  logLevel?: number;
}

export type WhisperModel = 'tiny' | 'tiny.en' | 'base' | 'base.en' | 'small' | 'small.en' | 'medium' | 'medium.en';

export interface TranscriptionResult {
  text: string;
  segments?: TranscriptionSegment[];
  language?: string;
  duration?: number;
  processingTime: number;
  model: string;
  method: 'whisper-server-local';
}

export interface TranscriptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  confidence?: number;
  words?: WordSegment[];
}

export interface WordSegment {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

export interface ModelInfo {
  name: string;
  size: number;
  exists: boolean;
  path: string;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'starting';
  whisperBinary: boolean;
  modelsDirectory: boolean;
  availableModels: string[];
  systemInfo: {
    platform: string;
    arch: string;
    cpus: number;
    memory: number;
  };
  uptime: number;
  version?: string;
}

export interface ProcessingJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  startTime: number;
  endTime?: number;
  error?: string;
  result?: TranscriptionResult;
}

export class WhisperServerService {
  private config: WhisperServerConfig;
  private processingJobs = new Map<string, ProcessingJob>();
  private healthStatus: HealthStatus;
  private startTime: number;

  constructor(config?: Partial<WhisperServerConfig>) {
    this.startTime = Date.now();
    
    this.config = {
      whisperBinaryPath: config?.whisperBinaryPath || this.findWhisperBinary(),
      modelsPath: config?.modelsPath || this.getDefaultModelsPath(),
      tempPath: config?.tempPath || path.join(os.tmpdir(), 'whisper-temp'),
      defaultModel: config?.defaultModel || 'base',
      maxConcurrentJobs: config?.maxConcurrentJobs || 3,
      cleanupTempFiles: config?.cleanupTempFiles !== false,
      logLevel: config?.logLevel || 1,
      ...config
    };

    this.initializeService();
  }

  /**
   * Initialize the service and perform health checks
   */
  private async initializeService(): Promise<void> {
    console.log('🎙️ Initializing Whisper Server Service...');
    
    try {
      // Create temp directory
      await fs.mkdir(this.config.tempPath, { recursive: true });
      
      // Update health status
      await this.updateHealthStatus();
      
      console.log(`✅ Whisper Server Service initialized successfully`);
      console.log(`📍 Binary: ${this.config.whisperBinaryPath}`);
      console.log(`📁 Models: ${this.config.modelsPath}`);
      console.log(`🔧 Default Model: ${this.config.defaultModel}`);
      
    } catch (error) {
      console.error('❌ Failed to initialize Whisper Server Service:', error);
      throw error;
    }
  }

  /**
   * Transcribe an audio file using local whisper.cpp
   */
  async transcribeFile(
    filePath: string, 
    options: WhisperOptions = {}
  ): Promise<TranscriptionResult> {
    const jobId = uuidv4();
    const startTime = Date.now();

    // Create processing job
    const job: ProcessingJob = {
      id: jobId,
      status: 'queued',
      progress: 0,
      startTime,
    };
    this.processingJobs.set(jobId, job);

    try {
      // Check if file exists
      await fs.access(filePath);
      
      // Update job status
      job.status = 'processing';
      job.progress = 10;

      // Prepare whisper command
      const command = await this.buildWhisperCommand(filePath, options);
      console.log('🚀 Executing whisper command:', command.join(' '));

      // Execute whisper
      const result = await this.executeWhisper(command, jobId);
      
      // Process results
      const processingTime = Date.now() - startTime;
      const transcriptionResult: TranscriptionResult = {
        text: result.text,
        segments: result.segments,
        language: result.language,
        duration: result.duration,
        processingTime,
        model: options.model || this.config.defaultModel,
        method: 'whisper-server-local'
      };

      // Update job
      job.status = 'completed';
      job.progress = 100;
      job.endTime = Date.now();
      job.result = transcriptionResult;

      return transcriptionResult;

    } catch (error: any) {
      // Update job with error
      job.status = 'failed';
      job.endTime = Date.now();
      job.error = error.message;

      console.error(`❌ Transcription failed for job ${jobId}:`, error);
      throw new Error(`Whisper transcription failed: ${error.message}`);
      
    } finally {
      // Clean up job after some time
      setTimeout(() => {
        this.processingJobs.delete(jobId);
      }, 5 * 60 * 1000); // Keep job info for 5 minutes
    }
  }

  /**
   * Get information about available models
   */
  async getAvailableModels(): Promise<ModelInfo[]> {
    const models: ModelInfo[] = [];
    
    const modelNames: WhisperModel[] = [
      'tiny', 'tiny.en', 'base', 'base.en', 
      'small', 'small.en', 'medium', 'medium.en'
    ];

    for (const modelName of modelNames) {
      const modelPath = path.join(this.config.modelsPath, `ggml-${modelName}.bin`);
      
      let size = 0;
      let exists = false;
      
      try {
        const stats = await fs.stat(modelPath);
        size = stats.size;
        exists = true;
      } catch {
        // Model doesn't exist
      }

      models.push({
        name: modelName,
        size,
        exists,
        path: modelPath
      });
    }

    return models;
  }

  /**
   * Get current health status
   */
  async getHealthStatus(): Promise<HealthStatus> {
    await this.updateHealthStatus();
    return this.healthStatus;
  }

  /**
   * Get processing job status
   */
  getJobStatus(jobId: string): ProcessingJob | null {
    return this.processingJobs.get(jobId) || null;
  }

  /**
   * Get all active jobs
   */
  getActiveJobs(): ProcessingJob[] {
    return Array.from(this.processingJobs.values());
  }

  /**
   * Cancel a processing job
   */
  cancelJob(jobId: string): boolean {
    const job = this.processingJobs.get(jobId);
    if (job && job.status === 'processing') {
      job.status = 'failed';
      job.error = 'Cancelled by user';
      job.endTime = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Build whisper command arguments
   */
  private async buildWhisperCommand(
    filePath: string, 
    options: WhisperOptions
  ): Promise<string[]> {
    const model = options.model || this.config.defaultModel;
    const modelPath = path.join(this.config.modelsPath, `ggml-${model}.bin`);

    // Check if model exists
    try {
      await fs.access(modelPath);
    } catch {
      throw new Error(`Model not found: ${model}. Path: ${modelPath}`);
    }

    const command = [
      this.config.whisperBinaryPath,
      '--model', modelPath,
      '--file', filePath,
      '--threads', (options.threads || os.cpus().length).toString(),
      '--output-format', 'json', // Always use JSON for parsing
      '--print-progress',
    ];

    // Add optional parameters
    if (options.language) {
      command.push('--language', options.language);
    }

    if (options.task === 'translate') {
      command.push('--translate');
    }

    if (options.wordTimestamps) {
      command.push('--word-timestamps');
    }

    if (options.temperature !== undefined) {
      command.push('--temperature', options.temperature.toString());
    }

    if (options.maxTokens) {
      command.push('--max-tokens', options.maxTokens.toString());
    }

    if (options.noSpeech !== undefined) {
      command.push('--no-speech-threshold', options.noSpeech.toString());
    }

    if (options.logLevel !== undefined) {
      command.push('--log-level', options.logLevel.toString());
    }

    return command;
  }

  /**
   * Execute whisper command and parse results
   */
  private async executeWhisper(
    command: string[], 
    jobId: string
  ): Promise<TranscriptionResult> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      
      const process: ChildProcess = spawn(command[0], command.slice(1), {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
        
        // Update progress based on output
        const job = this.processingJobs.get(jobId);
        if (job) {
          // Parse progress from whisper output
          const progressMatch = stdout.match(/progress = (\d+)%/);
          if (progressMatch) {
            job.progress = Math.max(job.progress, parseInt(progressMatch[1]));
          }
        }
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          try {
            // Parse JSON output from whisper
            const result = this.parseWhisperOutput(stdout);
            resolve(result);
          } catch (error) {
            reject(new Error(`Failed to parse whisper output: ${error}`));
          }
        } else {
          reject(new Error(`Whisper process failed with code ${code}: ${stderr}`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Failed to spawn whisper process: ${error.message}`));
      });

      // Set timeout for long-running processes
      setTimeout(() => {
        if (!process.killed) {
          process.kill('SIGTERM');
          reject(new Error('Whisper process timed out'));
        }
      }, 10 * 60 * 1000); // 10 minutes timeout
    });
  }

  /**
   * Parse whisper JSON output
   */
  private parseWhisperOutput(output: string): TranscriptionResult {
    try {
      // Find JSON in output (whisper outputs other text too)
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in whisper output');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        text: parsed.text || '',
        segments: parsed.segments || [],
        language: parsed.language,
        duration: parsed.duration,
        processingTime: 0, // Will be set by caller
        model: '', // Will be set by caller
        method: 'whisper-server-local'
      };
    } catch (error) {
      // Fallback: treat entire output as text
      return {
        text: output.trim(),
        segments: [],
        processingTime: 0,
        model: '',
        method: 'whisper-server-local'
      };
    }
  }

  /**
   * Update health status
   */
  private async updateHealthStatus(): Promise<void> {
    const availableModels = await this.getAvailableModels();
    
    let whisperBinary = false;
    try {
      await fs.access(this.config.whisperBinaryPath);
      whisperBinary = true;
    } catch {
      // Binary not found
    }

    let modelsDirectory = false;
    try {
      await fs.access(this.config.modelsPath);
      modelsDirectory = true;
    } catch {
      // Directory not found
    }

    const existingModels = availableModels
      .filter(m => m.exists)
      .map(m => m.name);

    this.healthStatus = {
      status: whisperBinary && modelsDirectory && existingModels.length > 0 
        ? 'healthy' 
        : 'unhealthy',
      whisperBinary,
      modelsDirectory,
      availableModels: existingModels,
      systemInfo: {
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        memory: Math.round(os.totalmem() / 1024 / 1024 / 1024) // GB
      },
      uptime: Date.now() - this.startTime
    };
  }

  /**
   * Find whisper binary in common locations
   */
  private findWhisperBinary(): string {
    const possiblePaths = [
      '/opt/whisper/whisper',
      '/usr/local/bin/whisper',
      '/usr/bin/whisper',
      '/Users/galahassa/.local/bin/whisper',
      path.join(os.homedir(), '.local/share/whisper/whisper'),
      path.join(process.cwd(), 'whisper'),
      'whisper' // In PATH
    ];

    for (const whisperPath of possiblePaths) {
      try {
        require('child_process').execSync(`${whisperPath} --help`, { stdio: 'ignore' });
        return whisperPath;
      } catch {
        continue;
      }
    }

    throw new Error('Whisper binary not found. Please install whisper.cpp or set WHISPER_BINARY_PATH');
  }

  /**
   * Get default models path
   */
  private getDefaultModelsPath(): string {
    const possiblePaths = [
      '/opt/whisper/models',
      path.join(os.homedir(), '.local/share/whisper/models'),
      path.join(process.cwd(), 'models'),
      path.join(process.cwd(), 'whisper-models')
    ];

    for (const modelsPath of possiblePaths) {
      try {
        require('fs').accessSync(modelsPath);
        return modelsPath;
      } catch {
        continue;
      }
    }

    // Default fallback
    return '/opt/whisper/models';
  }
}

interface WhisperServerConfig {
  whisperBinaryPath: string;
  modelsPath: string;
  tempPath: string;
  defaultModel: WhisperModel;
  maxConcurrentJobs: number;
  cleanupTempFiles: boolean;
  logLevel: number;
}