/**
 * Desktop Whisper Service
 * Wrapper around the existing API WhisperServerService for desktop use
 * Reuses battle-tested server implementation with local configuration
 */

import { execSync } from 'child_process';
import * as path from 'path';

import { app } from 'electron';
import * as log from 'electron-log';

import { WhisperServerService } from './whisperServer';

export interface DesktopWhisperConfig {
  model: string;
  language?: string;
  task?: 'transcribe' | 'translate';
  wordTimestamps?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export class DesktopWhisperService {
    private whisperServer: WhisperServerService;
    private initialized = false;
    private whisperBinaryPath: string | null = null;
    private whisperType: 'cpp' | 'python' | 'unknown' = 'unknown';

    constructor() {
        log.info('DesktopWhisperService: Initializing...');
        
        const userDataPath = app.getPath('userData');
        
        // Find the best available whisper binary
        this.whisperBinaryPath = this.findBestWhisperBinary();
        
        // Configure WhisperServerService for desktop use
        this.whisperServer = new WhisperServerService({
            whisperBinaryPath: this.whisperBinaryPath,
            modelsPath: path.join(userDataPath, 'whisper-models'),
            tempPath: path.join(userDataPath, 'temp', 'whisper'),
            defaultModel: 'base',
            maxConcurrentJobs: 2, // Desktop: limit concurrent jobs
            cleanupTempFiles: true,
            logLevel: 1
        });
        
        log.info(`DesktopWhisperService: Using ${this.whisperType} whisper at ${this.whisperBinaryPath}`);
    }

    /**
     * Find the best available whisper binary
     */
    private findBestWhisperBinary(): string {
        const userDataPath = app.getPath('userData');
        
        // Try whisper binaries in order of preference
        const candidates = [
            // 1. Local whisper.cpp installation (fastest)
            path.join(userDataPath, 'whisper', 'whisper'),
            '/opt/whisper/whisper',
            
            // 2. Python whisper (current working setup)
            '/Users/galahassa/.local/bin/whisper',
            path.join(process.env.HOME || '', '.local', 'bin', 'whisper'),
            
            // 3. System PATH
            'whisper'
        ];
        
        for (const candidate of candidates) {
            try {
                // Test if binary exists and works
                const result = execSync(`"${candidate}" --help`, { 
                    timeout: 5000,
                    encoding: 'utf8',
                    stdio: 'pipe'
                });
                
                // Determine binary type from help output
                if (result.includes('whisper.cpp') || result.includes('ggerganov')) {
                    this.whisperType = 'cpp';
                    log.info(`DesktopWhisperService: Found whisper.cpp binary: ${candidate}`);
                } else if (result.includes('openai-whisper') || result.includes('OpenAI')) {
                    this.whisperType = 'python';
                    log.info(`DesktopWhisperService: Found Python whisper binary: ${candidate}`);
                } else {
                    this.whisperType = 'unknown';
                    log.info(`DesktopWhisperService: Found unknown whisper binary: ${candidate}`);
                }
                
                return candidate;
                
            } catch (error) {
                log.debug(`DesktopWhisperService: Binary not available: ${candidate}`);
                continue;
            }
        }
        
        // No working binary found
        throw new Error('No whisper binary found. Please install whisper via pip or run the whisper.cpp setup script.');
    }

    /**
     * Initialize the desktop whisper service
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            log.info('DesktopWhisperService: Already initialized');
            return;
        }

        try {
            log.info('DesktopWhisperService: Testing whisper binary availability...');
            
            // Test whisper server health
            const healthStatus = await this.whisperServer.getHealthStatus();
            
            if (!healthStatus.whisperBinary) {
                throw new Error(`Whisper binary not accessible at ${this.whisperBinaryPath}`);
            }
            
            log.info('DesktopWhisperService: Health check passed');
            log.info(`Available models: ${healthStatus.availableModels.join(', ')}`);
            log.info(`System info: ${healthStatus.systemInfo.platform} ${healthStatus.systemInfo.arch}, ${healthStatus.systemInfo.cpus} CPUs`);
            
            this.initialized = true;
            log.info('DesktopWhisperService: Initialized successfully');
            
        } catch (error) {
            log.error('DesktopWhisperService: Failed to initialize:', error);
            throw new Error(`DesktopWhisperService initialization failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Initialize a specific model for transcription
     */
    async initializeModel(config: DesktopWhisperConfig): Promise<{ success: boolean; error?: string }> {
        if (!this.initialized) {
            return { success: false, error: 'DesktopWhisperService not initialized' };
        }

        try {
            log.info(`DesktopWhisperService: Model ${config.model} requested - no pre-loading needed`);
            
            // For whisper binaries, models are loaded on-demand during transcription
            // Just verify the model is available
            const availableModels = await this.whisperServer.getAvailableModels();
            const modelExists = availableModels.some((m: any) => m.name === config.model && m.exists);
            
            if (!modelExists) {
                const availableNames = availableModels.filter((m: any) => m.exists).map((m: any) => m.name);
                return { 
                    success: false, 
                    error: `Model '${config.model}' not found. Available models: ${availableNames.join(', ')}` 
                };
            }
            
            return { success: true };
            
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            log.error(`DesktopWhisperService: Model initialization failed:`, error);
            return { success: false, error: message };
        }
    }

    /**
     * Transcribe an audio file
     */
    async transcribeFile(
        filePath: string, 
        config: DesktopWhisperConfig
    ): Promise<{ success: boolean; result?: any; error?: string }> {
        if (!this.initialized) {
            return { success: false, error: 'DesktopWhisperService not initialized' };
        }

        try {
            log.info(`DesktopWhisperService: Starting transcription of ${filePath}`);
            log.info(`Config: model=${config.model}, language=${config.language || 'auto'}, task=${config.task || 'transcribe'}`);
            
            // Convert our config to WhisperServerService format
            const serverConfig = {
                model: config.model as any,
                language: config.language,
                task: config.task,
                wordTimestamps: config.wordTimestamps,
                temperature: config.temperature,
                maxTokens: config.maxTokens,
                outputFormat: 'json' as const
            };
            
            // Use the existing WhisperServerService
            const result = await this.whisperServer.transcribeFile(filePath, serverConfig);
            
            log.info(`DesktopWhisperService: Transcription completed in ${result.processingTime}ms`);
            
            return { 
                success: true, 
                result: {
                    ...result,
                    method: `whisper-desktop-${this.whisperType}`,
                    binaryPath: this.whisperBinaryPath
                }
            };
            
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            log.error(`DesktopWhisperService: Transcription failed:`, error);
            return { success: false, error: message };
        }
    }

    /**
     * Get processing jobs status
     */
    async getProcessingJobs(): Promise<{ success: boolean; jobs?: any[]; error?: string }> {
        try {
            const jobs = await this.whisperServer.getActiveJobs();
            return { success: true, jobs };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return { success: false, error: message };
        }
    }

    /**
     * Cancel a processing job
     */
    async cancelJob(jobId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const cancelled = await this.whisperServer.cancelJob(jobId);
            return { success: cancelled };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return { success: false, error: message };
        }
    }

    /**
     * Get available models
     */
    async getAvailableModels(): Promise<{ success: boolean; models?: any[]; error?: string }> {
        try {
            const models = await this.whisperServer.getAvailableModels();
            return { success: true, models };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return { success: false, error: message };
        }
    }

    /**
     * Get health status
     */
    async getHealthStatus(): Promise<{ success: boolean; status?: any; error?: string }> {
        try {
            const status = await this.whisperServer.getHealthStatus();
            return { 
                success: true, 
                status: {
                    ...status,
                    whisperType: this.whisperType,
                    binaryPath: this.whisperBinaryPath
                }
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return { success: false, error: message };
        }
    }

    /**
     * Check if the service is initialized
     */
    isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * Get the whisper binary type being used
     */
    getWhisperType(): 'cpp' | 'python' | 'unknown' {
        return this.whisperType;
    }

    /**
     * Get the whisper binary path
     */
    getBinaryPath(): string | null {
        return this.whisperBinaryPath;
    }

    /**
     * Cleanup resources
     */
    async cleanup(): Promise<void> {
        log.info('DesktopWhisperService: Cleaning up...');
        
        try {
            // Cancel all active jobs
            const jobs = await this.whisperServer.getActiveJobs();
            for (const job of jobs) {
                if (job.status === 'processing') {
                    await this.whisperServer.cancelJob(job.id);
                }
            }
            
            this.initialized = false;
            log.info('DesktopWhisperService: Cleanup completed');
            
        } catch (error) {
            log.error('DesktopWhisperService: Error during cleanup:', error);
        }
    }
}