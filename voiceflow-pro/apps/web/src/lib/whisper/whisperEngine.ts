/**
 * Whisper Web Engine
 * Main interface for running Whisper using @xenova/transformers.js
 */

import { env, pipeline, Pipeline } from '@xenova/transformers';
import { WhisperModelManager, WhisperModel } from './modelManager';
import { AudioProcessor } from './audioProcessor';

// Configure transformers.js for browser environment
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = '/api/models/download/';
env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/';

export interface WhisperConfig {
  model: WhisperModel;
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
}

// Map our model names to transformers.js model IDs
const MODEL_MAPPING: Record<string, string> = {
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

export class WhisperWebEngine {
  private transcriber: Pipeline | null = null;
  private currentModel: WhisperModel | null = null;
  private initialized = false;
  private audioContext: AudioContext | null = null;
  private audioProcessor: AudioProcessor;

  constructor() {
    this.audioProcessor = new AudioProcessor();
  }

  /**
   * Initialize the Whisper engine with a specific model
   */
  async initialize(config: WhisperConfig): Promise<void> {
    if (this.initialized && this.currentModel === config.model) {
      console.log('Whisper engine already initialized with the same model');
      return;
    }

    try {
      console.log(`Initializing Whisper engine with model: ${config.model}`);

      // Get the transformers.js model ID
      const modelId = MODEL_MAPPING[config.model];
      if (!modelId) {
        throw new Error(`Unsupported model: ${config.model}`);
      }

      // Create the automatic speech recognition pipeline
      this.transcriber = await pipeline('automatic-speech-recognition', modelId);

      this.currentModel = config.model;
      this.initialized = true;

      console.log('Whisper engine initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Whisper engine:', error);
      throw error;
    }
  }

  /**
   * Transcribe audio data
   */
  async transcribeAudio(
    audioData: Float32Array,
    options: Partial<WhisperConfig> = {}
  ): Promise<TranscriptionResult> {
    if (!this.initialized || !this.transcriber) {
      throw new Error('Whisper engine not initialized');
    }

    const startTime = performance.now();

    try {
      console.log(`Starting transcription of ${audioData.length} samples (${audioData.length / 16000}s of audio)`);
      
      // Ensure audio is mono and at 16kHz
      
      
      
      
         const processedAudio = await this.preprocessAudio(audioData);
      
      // Validate audio data
      if (!processedAudio || processedAudio.length === 0) {
        throw new Error('Processed audio data is empty');
      }
      
      console.log(`Processed audio: ${processedAudio.length} samples`);

      // Configure transcription options
      const transcribeOptions: any = {
        chunk_length_s: 30, // 30-second chunks
        stride_length_s: 5, // 5-second stride for overlapping
        return_timestamps: options.wordTimestamps || false,
        force_full_sequence: false,
      };

      // Set language if specified
      if (options.language) {
        transcribeOptions.language = options.language;
      }

      transcribeOptions.language = 'fr';

      // Set task (transcribe or translate)
      if (options.task) {
        transcribeOptions.task = options.task;
      }

      // Run transcription
      const result = await this.transcriber(processedAudio, transcribeOptions);
      
      const processingTime = performance.now() - startTime;
      console.log(`Transcription completed in ${processingTime.toFixed(2)}ms`);

      // Parse the result
      return this.parseTranscriptionResult(result, audioData.length / 16000, processingTime);

    } catch (error) {
      console.error('Error during transcription:', error);
      throw new Error(`Transcription failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Transcribe audio file
   */
  async transcribeFile(
    file: File,
    options: Partial<WhisperConfig> = {}
  ): Promise<TranscriptionResult> {
    // Convert file to audio data
    const audioData = await this.fileToAudioData(file);
    return this.transcribeAudio(audioData, options);
  }

  /**
   * Start real-time transcription from MediaStream
   */
  async startRealtimeTranscription(
    stream: MediaStream,
    onSegment: (segment: TranscriptionSegment) => void,
    options: Partial<WhisperConfig> = {}
  ): Promise<() => void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }

    const source = this.audioContext.createMediaStreamSource(stream);
    const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    
    let audioBuffer: Float32Array[] = [];
    const bufferDurationMs = 3000; // 3 seconds
    const sampleRate = this.audioContext.sampleRate;
    const maxBufferLength = (bufferDurationMs / 1000) * sampleRate;

    processor.onaudioprocess = async (event) => {
      const inputData = event.inputBuffer.getChannelData(0);
      audioBuffer.push(new Float32Array(inputData));

      // Calculate current buffer length
      const currentLength = audioBuffer.reduce((sum, chunk) => sum + chunk.length, 0);

      if (currentLength >= maxBufferLength) {
        // Combine buffer chunks
        const combinedBuffer = new Float32Array(currentLength);
        let offset = 0;
        for (const chunk of audioBuffer) {
          combinedBuffer.set(chunk, offset);
          offset += chunk.length;
        }

        try {
          // Transcribe the buffer
          const result = await this.transcribeAudio(combinedBuffer, options);
          
          // Call the callback with each segment
          for (const segment of result.segments) {
            onSegment(segment);
          }
        } catch (error) {
          console.error('Real-time transcription error:', error);
        }

        // Clear buffer
        audioBuffer = [];
      }
    };

    source.connect(processor);
    processor.connect(this.audioContext.destination);

    // Return cleanup function
    return () => {
      processor.disconnect();
      source.disconnect();
    };
  }

  /**
   * Convert file to audio data
   */
  private async fileToAudioData(file: File): Promise<Float32Array> {
    try {
      return await this.audioProcessor.processAudioFile(file);
    } catch (error) {
      console.error('Error processing audio file:', error);
      throw new Error(`Failed to process audio file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Preprocess audio to ensure it's mono and at 16kHz
   */
  private async preprocessAudio(audioData: Float32Array): Promise<Float32Array> {
    // For transformers.js, we don't need to resample to 16kHz
    // The pipeline handles resampling internally
    return audioData;
  }

  /**
   * Parse transcription result from transformers.js
   */
  private parseTranscriptionResult(
    result: any,
    duration: number,
    processingTime: number
  ): TranscriptionResult {
    console.log('Raw transcription result:', result);

    let text = '';
    let segments: TranscriptionSegment[] = [];

    if (typeof result === 'string') {
      // Simple text result
      text = result;
      segments = [{
        text: result,
        start: 0,
        end: duration
      }];
    } else if (result.text) {
      // Result with text and possibly chunks
      text = result.text;
      
      if (result.chunks && Array.isArray(result.chunks)) {
        segments = result.chunks.map((chunk: any) => ({
          text: chunk.text,
          start: chunk.timestamp?.[0] || 0,
          end: chunk.timestamp?.[1] || duration,
          confidence: chunk.confidence
        }));
      } else {
        // Single segment
        segments = [{
          text: result.text,
          start: 0,
          end: duration
        }];
      }
    } else {
      throw new Error('Unexpected transcription result format');
    }

    return {
      text: text.trim(),
      segments,
      duration,
      processingTime
    };
  }

  /**
   * Destroy the engine and clean up resources
   */
  async destroy(): Promise<void> {
    console.log('Destroying Whisper engine...');
    
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this.transcriber = null;
    this.initialized = false;
    this.currentModel = null;

    console.log('Whisper engine destroyed');
  }

  /**
   * Check if the engine is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the current model
   */
  getCurrentModel(): WhisperModel | null {
    return this.currentModel;
  }

  /**
   * Get available models
   */
  getAvailableModels(): WhisperModel[] {
    return Object.keys(MODEL_MAPPING) as WhisperModel[];
  }
}