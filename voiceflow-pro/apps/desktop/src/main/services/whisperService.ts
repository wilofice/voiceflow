import * as path from 'path';
import * as os from 'os';

import { BrowserWindow } from 'electron';
import * as log from 'electron-log';
import * as fs from 'fs-extra';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Helper to bypass transpilation of dynamic import() to require() in CommonJS environments
const dynamicImport = new Function('specifier', 'return import(specifier)');

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
            const { pipeline, env } = await dynamicImport('@xenova/transformers');

            // Set up transformers for Node.js environment
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
            const { pipeline } = await dynamicImport('@xenova/transformers');
            this.engine = await pipeline('automatic-speech-recognition', modelId);

            this.currentModel = config.model;
            log.info(`Model ${config.model} loaded successfully`);
        } catch (error) {
            log.error(`Failed to load model ${config.model}:`, error);
            throw error;
        }
    }

    async transcribeFile(filePath: string, config: WhisperConfig): Promise<TranscriptionResult> {
        if (!this.initialized) {
            await this.initialize();
        }

        if (!this.engine || this.currentModel !== config.model) {
            log.info(`Model ${config.model} not loaded. Initializing now...`);
            await this.initializeModel(config);
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

    /**
     * Transcribe a raw audio buffer (from live recording via MediaRecorder).
     * Writes the buffer to a temp .webm file, reuses the same FFmpeg→Float32Array
     * pipeline as transcribeFile(), then cleans up both temp files.
     */
    async transcribeBuffer(buffer: Buffer, config: WhisperConfig): Promise<TranscriptionResult> {
        if (!this.initialized) {
            await this.initialize();
        }

        if (!this.engine || this.currentModel !== config.model) {
            await this.initializeModel(config);
        }

        const jobId = this.generateJobId();
        const startTime = performance.now();
        const tempWebmPath = path.join(
            os.tmpdir(),
            `whisper_rec_${Date.now()}_${Math.random().toString(36).substring(2)}.webm`
        );

        try {
            log.info(`Starting buffer transcription job ${jobId}`);

            // Write the ArrayBuffer to a temp webm file so FFmpeg can process it
            await fs.writeFile(tempWebmPath, buffer);

            this.processingJobs.set(jobId, { config, startTime, status: 'processing' });

            this.notifyProgress(jobId, { stage: 'loading', progress: 10, message: 'Processing recorded audio...' });

            const audioData = await this.loadAudioFile(tempWebmPath);

            this.notifyProgress(jobId, { stage: 'transcribing', progress: 30, message: 'Transcribing recording...' });

            const transcribeOptions: any = {
                chunk_length_s: 30,
                stride_length_s: 5,
                return_timestamps: true,
                force_full_sequence: false,
            };

            if (config.language && config.language !== 'auto') {
                transcribeOptions.language = config.language;
            }

            const result = await this.engine(audioData, transcribeOptions);
            const processingTime = performance.now() - startTime;

            this.notifyProgress(jobId, { stage: 'complete', progress: 100, message: 'Transcription complete' });

            const transcriptionResult = this.parseTranscriptionResult(
                result,
                buffer.length / 1024 / 1024,
                processingTime
            );
            this.processingJobs.delete(jobId);

            log.info(`Buffer transcription job ${jobId} completed in ${processingTime.toFixed(2)}ms`);
            return transcriptionResult;

        } catch (error) {
            log.error(`Buffer transcription job ${jobId} failed:`, error);
            this.processingJobs.delete(jobId);
            throw error;
        } finally {
            // Always clean up the temp webm file
            await fs.remove(tempWebmPath).catch(e => log.warn('Temp webm cleanup failed', e));
        }
    }

    async loadAudioFile(filePath: string): Promise<Float32Array> {
        return new Promise(async (resolve, reject) => {
            try {
                log.info(`Decoding audio from ${filePath} using FFmpeg...`);

                // We use a temporary file to bypass Node.js stream backpressure that crashes fluent-ffmpeg natively
                const tempFilePath = path.join(os.tmpdir(), `whisper_${Date.now()}_${Math.random().toString(36).substring(2)}.pcm`);

                // Whisper expects: 16kHz, 1 channel (mono), 32-bit float Little Endian
                ffmpeg(filePath)
                    .audioChannels(1)
                    .audioFrequency(16000)
                    .format('f32le')
                    .on('end', async () => {
                        try {
                            log.info(`FFmpeg decoding finished. Reading temp PCM file for ${filePath}`);
                            const buffer = await fs.readFile(tempFilePath);
                            const audioData = new Float32Array(
                                buffer.buffer,
                                buffer.byteOffset,
                                buffer.byteLength / 4
                            );
                            // Safely clean up
                            await fs.remove(tempFilePath).catch(e => log.warn("Temp cleanup failed", e));
                            resolve(audioData);
                        } catch (e) {
                            reject(e);
                        }
                    })
                    .on('error', (err: Error) => {
                        log.error(`FFmpeg processing failed for ${filePath}:`, err);
                        fs.remove(tempFilePath).catch(() => { });
                        reject(new Error(`FFmpeg error: ${err.message}`));
                    })
                    .save(tempFilePath);

            } catch (error) {
                log.error(`Failed to setup audio pipeline for ${filePath}:`, error);
                reject(new Error(`Audio pipeline error: ${error instanceof Error ? error.message : String(error)}`));
            }
        });
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