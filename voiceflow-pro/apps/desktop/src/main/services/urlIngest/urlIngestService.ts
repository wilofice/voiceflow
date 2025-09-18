/**
 * URL Ingest Service
 * Main service that coordinates URL validation, downloading, and transcription
 */

import { EventEmitter } from 'events';
import * as log from 'electron-log';
import * as path from 'path';
import * as fs from 'fs-extra';
import { app } from 'electron';
import { URLValidatorService, ValidationResult } from './urlValidatorService';
import { DownloadManager, DownloadOptions, DownloadResult } from './downloadManager';
import { DesktopWhisperService } from '../desktopWhisperService';
import type { Provider } from './urlValidatorService';

export interface IngestOptions extends DownloadOptions {
  autoTranscribe?: boolean;
  transcriptionModel?: string;
  transcriptionLanguage?: string;
  deleteAfterTranscribe?: boolean;
}

export interface IngestResult {
  success: boolean;
  jobId: string;
  url: string;
  provider: Provider | null;
  downloadPath?: string;
  transcriptPath?: string;
  transcript?: string;
  metadata?: any;
  error?: string;
  duration?: number; // Total processing time in ms
}

export interface IngestProgress {
  jobId: string;
  stage: 'validating' | 'downloading' | 'transcribing' | 'complete';
  percent: number;
  message: string;
  details?: any;
}

export class URLIngestService extends EventEmitter {
  private validator: URLValidatorService;
  private downloadManager: DownloadManager;
  private whisperService: DesktopWhisperService | null;
  private activeJobs = new Map<string, IngestResult>();
  private transcriptDir: string;

  constructor(whisperService?: DesktopWhisperService) {
    super();
    
    this.validator = new URLValidatorService();
    this.downloadManager = new DownloadManager();
    this.whisperService = whisperService || null;
    
    // Set up transcript directory
    this.transcriptDir = path.join(app.getPath('userData'), 'transcripts');
    fs.ensureDirSync(this.transcriptDir);
    
    // Forward download progress events
    this.downloadManager.on('progress', (progress) => {
      this.emit('progress', {
        jobId: progress.jobId,
        stage: 'downloading',
        percent: progress.percent,
        message: `Downloading... ${Math.round(progress.percent)}%`,
        details: progress
      });
    });
    
    log.info('URLIngestService: Initialized');
  }

  /**
   * Process a URL - validate, download, and optionally transcribe
   */
  async processURL(url: string, options: IngestOptions = {}): Promise<IngestResult> {
    const startTime = Date.now();
    const jobId = this.generateJobId(url);
    
    // Initialize result
    const result: IngestResult = {
      success: false,
      jobId,
      url,
      provider: null
    };
    
    this.activeJobs.set(jobId, result);
    
    try {
      // Step 1: Validate URL
      log.info(`URLIngestService: Validating URL - ${url}`);
      this.emitProgress(jobId, 'validating', 10, 'Validating URL...');
      
      const validation = await this.validator.validateURL(url);
      
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid URL');
      }
      
      result.provider = validation.provider;
      result.metadata = validation.metadata;
      
      // Step 2: Download media
      log.info(`URLIngestService: Downloading from ${validation.provider}`);
      this.emitProgress(jobId, 'downloading', 20, 'Starting download...');
      
      const downloadResult = await this.downloadManager.download(
        url, 
        validation.provider!, 
        options
      );
      
      if (!downloadResult.success) {
        throw new Error(downloadResult.error || 'Download failed');
      }
      
      result.downloadPath = downloadResult.filePath;
      
      // Merge metadata
      if (downloadResult.metadata) {
        result.metadata = { ...result.metadata, ...downloadResult.metadata };
      }
      
      // Step 3: Transcribe (if requested and whisper is available)
      if (options.autoTranscribe !== false && this.whisperService && result.downloadPath) {
        log.info(`URLIngestService: Starting transcription`);
        this.emitProgress(jobId, 'transcribing', 70, 'Transcribing audio...');
        
        const transcriptResult = await this.transcribeFile(
          result.downloadPath,
          jobId,
          options
        );
        
        if (transcriptResult.success) {
          result.transcriptPath = transcriptResult.outputPath;
          result.transcript = transcriptResult.text;
        }
        
        // Delete original file if requested
        if (options.deleteAfterTranscribe && result.downloadPath) {
          try {
            await fs.remove(result.downloadPath);
            log.info(`URLIngestService: Deleted original file after transcription`);
          } catch (error) {
            log.warn(`URLIngestService: Failed to delete original file:`, error);
          }
        }
      }
      
      // Success!
      result.success = true;
      result.duration = Date.now() - startTime;
      
      this.emitProgress(jobId, 'complete', 100, 'Processing complete!');
      log.info(`URLIngestService: Successfully processed ${url} in ${result.duration}ms`);
      
      return result;
      
    } catch (error) {
      log.error(`URLIngestService: Failed to process URL:`, error);
      result.success = false;
      result.error = error instanceof Error ? error.message : 'Processing failed';
      result.duration = Date.now() - startTime;
      
      this.emit('error', { jobId, error: result.error });
      return result;
      
    } finally {
      this.activeJobs.set(jobId, result);
      this.emit('complete', result);
    }
  }

  /**
   * Transcribe a downloaded file
   */
  private async transcribeFile(
    filePath: string, 
    jobId: string,
    options: IngestOptions
  ): Promise<any> {
    if (!this.whisperService) {
      throw new Error('Whisper service not available');
    }
    
    try {
      // Prepare transcription config
      const config = {
        model: options.transcriptionModel || 'base',
        language: options.transcriptionLanguage || 'auto',
        task: 'transcribe' as const,
        outputFormat: 'json'
      };
      
      // Start transcription
      const result = await this.whisperService.transcribeFile(filePath, config);
      
      if (result.success && result.result) {
        // Save transcript to file
        const transcriptName = `${path.basename(filePath, path.extname(filePath))}_transcript.json`;
        const transcriptPath = path.join(this.transcriptDir, transcriptName);
        
        await fs.writeJson(transcriptPath, {
          jobId,
          url: this.activeJobs.get(jobId)?.url,
          filePath,
          ...result.result,
          timestamp: new Date().toISOString()
        }, { spaces: 2 });
        
        return {
          success: true,
          text: result.result.text,
          outputPath: transcriptPath,
          segments: result.result.segments
        };
      }
      
      throw new Error(result.error || 'Transcription failed');
      
    } catch (error) {
      log.error('URLIngestService: Transcription failed:', error);
      throw error;
    }
  }

  /**
   * Validate a URL without downloading
   */
  async validateURL(url: string): Promise<ValidationResult> {
    return this.validator.validateURL(url);
  }

  /**
   * Get suggested filename for a URL
   */
  getSuggestedFilename(url: string): string {
    const provider = this.validator.detectProvider(url);
    return this.validator.getSuggestedFilename(url, provider);
  }

  /**
   * Cancel an active job
   */
  cancelJob(jobId: string): void {
    this.downloadManager.cancelDownload(jobId);
    
    const job = this.activeJobs.get(jobId);
    if (job) {
      job.success = false;
      job.error = 'Cancelled by user';
      this.emit('cancelled', { jobId });
    }
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): IngestResult | undefined {
    return this.activeJobs.get(jobId);
  }

  /**
   * Get all jobs
   */
  getAllJobs(): IngestResult[] {
    return Array.from(this.activeJobs.values());
  }

  /**
   * Clear completed jobs
   */
  clearCompletedJobs(): void {
    for (const [jobId, job] of this.activeJobs) {
      if (job.success || job.error) {
        this.activeJobs.delete(jobId);
      }
    }
  }

  /**
   * Set WhisperService
   */
  setWhisperService(whisperService: DesktopWhisperService): void {
    this.whisperService = whisperService;
  }

  /**
   * Check if transcription is available
   */
  isTranscriptionAvailable(): boolean {
    return this.whisperService !== null;
  }

  /**
   * Get download directory
   */
  getDownloadDirectory(): string {
    return this.downloadManager.getDownloadDirectory();
  }

  /**
   * Set download directory
   */
  setDownloadDirectory(dir: string): void {
    this.downloadManager.setDownloadDirectory(dir);
  }

  /**
   * Emit progress event
   */
  private emitProgress(
    jobId: string, 
    stage: IngestProgress['stage'], 
    percent: number, 
    message: string,
    details?: any
  ): void {
    const progress: IngestProgress = {
      jobId,
      stage,
      percent,
      message,
      details
    };
    
    this.emit('progress', progress);
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(url: string): string {
    return `ingest_${Date.now()}_${Buffer.from(url).toString('base64').substr(0, 8)}`;
  }

  /**
   * Clean up service
   */
  async cleanup(): Promise<void> {
    this.downloadManager.cancelAllDownloads();
    this.activeJobs.clear();
    this.removeAllListeners();
    log.info('URLIngestService: Cleaned up');
  }
}