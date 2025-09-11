import { BrowserWindow } from 'electron';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as log from 'electron-log';

// Import the existing WhisperWebEngine from the web app
// We'll adapt it for Node.js/Electron environment
import { WhisperConfig, TranscriptionResult, TranscriptionSegment } from '../types/whisper';

/**
 * Desktop Whisper Service
 * Wraps the existing WhisperWebEngine for desktop use with file system integration
 */
export class WhisperService {
    private engine: any = null; // Will be dynamically imported
    private initialized = false;
    private currentModel: string | null = null;
    private processingJobs: Map<string, any> = new Map();

    constructor() {
        log.info('WhisperService initialized');
    }

    async initialize(): Promise<void> {
        if (this.initialized) {
            log.info('WhisperService already initialized');
            return;
        }

        try {
            log.info('Initializing WhisperService...');
            
            // Dynamically import the transformers.js library
            const { pipeline } = await import('@xenova/transformers');
            
            // Set up transformers for Node.js environment
            const { env } = await import('@xenova/transformers');
            env.allowRemoteModels = true;
            env.allowLocalModels = false;
            
            log.info('Transformers.js configured for desktop environment');
            
            this.initialized = true;
            log.info('WhisperService initialized successfully');
        } catch (error) {
            log.error('Failed to initialize WhisperService:', error);
            throw error;
        }
    }

    async initializeModel(config: WhisperConfig): Promise<void> {
        if (!this.initialized) {
            throw new Error('WhisperService not initialized');
        }

        if (this.currentModel === config.model) {
            log.info(`Model ${config.model} already loaded`);
            return;
        }

        try {
            log.info(`Loading Whisper model: ${config.model}`);
            
            // Map our model names to transformers.js models
            const modelMapping: Record<string, string> = {
                'tiny': 'Xenova/whisper-tiny',
                'tiny.en': 'Xenova/whisper-tiny.en',
                'base': 'Xenova/whisper-base',
                'base.en': 'Xenova/whisper-base.en',
                'small': 'Xenova/whisper-small',
                'small.en': 'Xenova/whisper-small.en',
                'medium': 'Xenova/whisper-medium',
                'medium.en': 'Xenova/whisper-medium.en',
                'large-v3': 'Xenova/whisper-large-v3',
            };

            const modelId = modelMapping[config.model] || modelMapping['base'];
            
            // Create the transcriber pipeline
            const { pipeline } = await import('@xenova/transformers');
            this.engine = await pipeline('automatic-speech-recognition', modelId);
            
            this.currentModel = config.model;
            log.info(`Model ${config.model} loaded successfully`);
        } catch (error) {
            log.error(`Failed to load model ${config.model}:`, error);
            throw error;
        }
    }

    async transcribeFile(filePath: string, config: WhisperConfig): Promise<TranscriptionResult> {
        if (!this.initialized || !this.engine) {
            throw new Error('WhisperService not initialized or no model loaded');
        }

        const jobId = this.generateJobId();
        const startTime = performance.now();

        try {
            log.info(`Starting transcription job ${jobId} for file: ${filePath}`);

            // Check if file exists
            if (!await fs.pathExists(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            // Get file stats
            const stats = await fs.stat(filePath);
            const fileSize = stats.size;
            
            log.info(`File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

            // Register the job
            this.processingJobs.set(jobId, {
                filePath,
                config,
                startTime,
                status: 'processing'
            });

            // Notify renderer about job start
            this.notifyProgress(jobId, {
                stage: 'loading',
                progress: 0,
                message: 'Loading audio file...'
            });

            // Load and process the audio file
            const audioData = await this.loadAudioFile(filePath);
            
            this.notifyProgress(jobId, {
                stage: 'transcribing',
                progress: 20,
                message: 'Transcribing audio...'
            });

            // Configure transcription options
            const transcribeOptions: any = {
                chunk_length_s: 30,
                stride_length_s: 5,
                return_timestamps: config.wordTimestamps || false,
                force_full_sequence: false,
            };

            if (config.language && config.language !== 'auto') {
                transcribeOptions.language = config.language;
            }

            if (config.task) {
                transcribeOptions.task = config.task;
            }

            // Run transcription
            const result = await this.engine(audioData, transcribeOptions);
            
            const processingTime = performance.now() - startTime;
            
            this.notifyProgress(jobId, {
                stage: 'complete',
                progress: 100,
                message: 'Transcription complete'
            });

            // Parse the result
            const transcriptionResult = this.parseTranscriptionResult(result, stats.size / 1024 / 1024, processingTime);
            
            // Clean up the job
            this.processingJobs.delete(jobId);
            
            log.info(`Transcription job ${jobId} completed in ${processingTime.toFixed(2)}ms`);
            
            return transcriptionResult;

        } catch (error) {
            log.error(`Transcription job ${jobId} failed:`, error);
            
            this.notifyProgress(jobId, {
                stage: 'error',
                progress: 0,
                message: `Transcription failed: ${error instanceof Error ? error.message : String(error)}`,
                error: error instanceof Error ? error.message : String(error)
            });

            // Clean up failed job
            this.processingJobs.delete(jobId);
            
            throw error;
        }
    }

    async loadAudioFile(filePath: string): Promise<Float32Array> {
        // For now, we'll use a simple approach
        // In a full implementation, we would use FFmpeg or similar
        // to handle various audio formats and convert to the format expected by Whisper
        
        try {
            // Read the file as buffer
            const buffer = await fs.readFile(filePath);
            
            // For demonstration, we'll create a simple audio loader
            // In production, you'd want to use a proper audio decoding library
            const audioData = new Float32Array(buffer.length / 2);
            
            // This is a simplified conversion - in reality, you'd need proper audio decoding
            for (let i = 0; i < audioData.length; i++) {
                audioData[i] = (buffer[i * 2] + buffer[i * 2 + 1] * 256) / 32768;
            }
            
            return audioData;
        } catch (error) {
            log.error(`Failed to load audio file ${filePath}:`, error);
            throw new Error(`Failed to load audio file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private parseTranscriptionResult(result: any, fileSizeMB: number, processingTimeMs: number): TranscriptionResult {
        log.info('Parsing transcription result:', result);

        let text = '';
        let segments: TranscriptionSegment[] = [];

        if (typeof result === 'string') {
            text = result;
            segments = [{
                text: result,
                start: 0,
                end: 0, // We don't have duration info in this simple implementation
                confidence: 1.0
            }];
        } else if (result.text) {
            text = result.text;
            
            if (result.chunks && Array.isArray(result.chunks)) {
                segments = result.chunks.map((chunk: any) => ({
                    text: chunk.text,
                    start: chunk.timestamp?.[0] || 0,
                    end: chunk.timestamp?.[1] || 0,
                    confidence: chunk.confidence || 1.0
                }));
            } else {
                segments = [{
                    text: result.text,
                    start: 0,
                    end: 0,
                    confidence: 1.0
                }];
            }
        } else {
            throw new Error('Unexpected transcription result format');
        }

        return {
            text: text.trim(),
            segments,
            language: result.language,
            processingTime: processingTimeMs,
            fileSizeMB,
            model: this.currentModel || 'unknown'
        };
    }

    private generateJobId(): string {
        return `whisper_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private notifyProgress(jobId: string, progress: any): void {
        // Send progress updates to all renderer processes
        const windows = BrowserWindow.getAllWindows();
        windows.forEach(window => {
            window.webContents.send('whisper:progress', { jobId, ...progress });
        });
    }

    async getProcessingJobs(): Promise<any[]> {
        return Array.from(this.processingJobs.values());
    }

    async cancelJob(jobId: string): Promise<void> {
        if (this.processingJobs.has(jobId)) {
            // Mark job as cancelled
            const job = this.processingJobs.get(jobId);
            job.status = 'cancelled';
            
            // Clean up
            this.processingJobs.delete(jobId);
            
            log.info(`Job ${jobId} cancelled`);
        }
    }

    async cleanup(): Promise<void> {
        log.info('Cleaning up WhisperService...');
        
        // Cancel all pending jobs
        for (const jobId of this.processingJobs.keys()) {
            await this.cancelJob(jobId);
        }
        
        // Clean up resources
        this.engine = null;
        this.currentModel = null;
        this.initialized = false;
        
        log.info('WhisperService cleanup completed');
    }
}