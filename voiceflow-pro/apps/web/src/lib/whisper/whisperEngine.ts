/**
 * Whisper Web Engine
 * Main interface for running Whisper.cpp in the browser via WebAssembly
 */

import { WhisperModelManager, WhisperModel } from './modelManager';

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

export interface WhisperModule {
  init: (modelPath: string) => boolean;
  free: () => void;
  full_default: (audioData: any, language: string, translate: boolean) => number;
  [key: string]: any;
}

declare global {
  interface Window {
    Module?: any;
    whisper_factory?: () => { ready: Promise<any> };
  }
}

export class WhisperWebEngine {
  private module: WhisperModule | null = null;
  private context: number | null = null;
  private modelManager: WhisperModelManager;
  private currentModel: WhisperModel | null = null;
  private worker: Worker | null = null;
  private initialized = false;
  private audioContext: AudioContext | null = null;

  constructor() {
    this.modelManager = WhisperModelManager.getInstance();
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
      // Clean up previous instance if exists
      if (this.initialized) {
        await this.destroy();
      }

      console.log(`Initializing Whisper engine with model: ${config.model}`);

      // Load the WASM module
      await this.loadWASMModule();

      // Load the model
      const modelBuffer = await this.loadModel(config.model);

      // Initialize Whisper context
      await this.initializeContext(modelBuffer, config);

      this.currentModel = config.model;
      this.initialized = true;

      console.log('Whisper engine initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Whisper engine:', error);
      throw error;
    }
  }

  /**
   * Load the WASM module
   */
  private async loadWASMModule(): Promise<void> {
    // Load the proper whisper bindings
    if (!window.whisper_factory) {
      await this.loadScript('/wasm/whisper-bindings.js');
    }

    if (!window.whisper_factory) {
      throw new Error('Whisper factory function not found');
    }

    try {
      console.log('Initializing Whisper module...');
      // The whisper.js exports a factory function that returns a promise with a ready method
      const modulePromise = window.whisper_factory();
      this.module = await modulePromise.ready;
      console.log('WASM module loaded successfully');
      console.log('Available module methods:', Object.keys(this.module).filter(k => typeof this.module[k] === 'function'));
    } catch (error) {
      console.error('Failed to initialize Whisper module:', error);
      throw error;
    }
  }

  /**
   * Load a script dynamically
   */
  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  /**
   * Load a model from cache or download it
   */
  private async loadModel(modelType: WhisperModel): Promise<ArrayBuffer> {
    // Try to get from cache first
    let modelBuffer = await this.modelManager.getCachedModel(modelType);
    
    if (!modelBuffer) {
      console.log(`Model ${modelType} not cached, downloading...`);
      modelBuffer = await this.modelManager.downloadModel(modelType);
    }

    return modelBuffer;
  }

  /**
   * Initialize Whisper context with the model
   */
  private async initializeContext(modelBuffer: ArrayBuffer, config: WhisperConfig): Promise<void> {
    if (!this.module) {
      throw new Error('WASM module not loaded');
    }

    try {
      // Write the model to the WASM file system using the correct API
      const modelData = new Uint8Array(modelBuffer);
      const modelPath = 'whisper.bin'; // Use simple filename as in the test
      
      console.log(`Writing model to WASM FS: ${modelPath} (${modelData.length} bytes)`);
      
      // Use FS_createDataFile like in the test file
      if (this.module.FS_createDataFile) {
        this.module.FS_createDataFile('/', modelPath, modelData, true, true);
      } else {
        throw new Error('WASM module FS_createDataFile not available');
      }

      // Initialize whisper with the model file
      console.log('Initializing Whisper context...');
      const success = this.module.init(modelPath);
      
      if (!success) {
        throw new Error('Failed to initialize Whisper context');
      }

      this.context = 1; // Set as initialized
      this.modelPath = modelPath;
      console.log('Whisper context initialized successfully');
    } catch (error) {
      console.error('Error initializing Whisper context:', error);
      console.log('Available module methods:', Object.keys(this.module).filter(k => typeof this.module[k] === 'function'));
      throw error;
    }
  }

  /**
   * Transcribe audio from Float32Array
   */
  async transcribeAudio(
    audioData: Float32Array,
    options: Partial<WhisperConfig> = {}
  ): Promise<TranscriptionResult> {
    if (!this.initialized || !this.module || !this.context) {
      throw new Error('Whisper engine not initialized');
    }

    const startTime = performance.now();

    try {
      // Ensure audio is mono and at 16kHz
      const processedAudio = await this.preprocessAudio(audioData);

      // Convert to typed array
      const audioTypedArray = new Float32Array(processedAudio);

      // Run whisper
      const language = options.language || 'en';
      const translate = options.task === 'translate';
      
      const result = this.module.full_default(audioTypedArray, language, translate);

      if (result !== 0) {
        throw new Error(`Whisper processing failed with code: ${result}`);
      }

      // Extract results - for now return a simple result
      // In a real implementation, we would extract the actual segments
      const transcription = this.extractResults();
      
      const processingTime = performance.now() - startTime;
      transcription.processingTime = processingTime;

      return transcription;
    } catch (error) {
      console.error('Transcription failed:', error);
      throw error;
    }
  }

  /**
   * Transcribe audio from a File
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
   * Transcribe audio in real-time from a MediaStream
   */
  async startRealtimeTranscription(
    stream: MediaStream,
    onSegment: (segment: TranscriptionSegment) => void,
    options: Partial<WhisperConfig> = {}
  ): Promise<() => void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: 16000 });
    }

    const source = this.audioContext.createMediaStreamSource(stream);
    const processor = this.audioContext.createScriptProcessor(16384, 1, 1);
    
    let audioBuffer: Float32Array[] = [];
    let isProcessing = false;

    processor.onaudioprocess = async (event) => {
      if (isProcessing) return;

      const inputData = event.inputBuffer.getChannelData(0);
      audioBuffer.push(new Float32Array(inputData));

      // Process every 2 seconds of audio
      if (audioBuffer.length * 16384 >= 16000 * 2) {
        isProcessing = true;

        // Combine buffers
        const totalLength = audioBuffer.reduce((acc, buf) => acc + buf.length, 0);
        const combinedBuffer = new Float32Array(totalLength);
        let offset = 0;
        
        for (const buf of audioBuffer) {
          combinedBuffer.set(buf, offset);
          offset += buf.length;
        }

        // Clear buffer
        audioBuffer = [];

        try {
          // Transcribe the chunk
          const result = await this.transcribeAudio(combinedBuffer, options);
          
          // Send segments
          for (const segment of result.segments) {
            onSegment(segment);
          }
        } catch (error) {
          console.error('Real-time transcription error:', error);
        }

        isProcessing = false;
      }
    };

    source.connect(processor);
    processor.connect(this.audioContext.destination);

    // Return stop function
    return () => {
      source.disconnect();
      processor.disconnect();
    };
  }

  /**
   * Preprocess audio to ensure it's mono 16kHz
   */
  private async preprocessAudio(audioData: Float32Array): Promise<Float32Array> {
    // For now, assume the audio is already at 16kHz mono
    // In a real implementation, we would resample if needed
    return audioData;
  }

  /**
   * Convert File to Float32Array audio data
   */
  private async fileToAudioData(file: File): Promise<Float32Array> {
    const arrayBuffer = await file.arrayBuffer();
    
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: 16000 });
    }

    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    
    // Convert to mono if stereo
    let channelData: Float32Array;
    if (audioBuffer.numberOfChannels > 1) {
      channelData = new Float32Array(audioBuffer.length);
      for (let i = 0; i < audioBuffer.length; i++) {
        let sum = 0;
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
          sum += audioBuffer.getChannelData(channel)[i];
        }
        channelData[i] = sum / audioBuffer.numberOfChannels;
      }
    } else {
      channelData = audioBuffer.getChannelData(0);
    }

    // Resample to 16kHz if needed
    if (audioBuffer.sampleRate !== 16000) {
      const ratio = 16000 / audioBuffer.sampleRate;
      const newLength = Math.floor(channelData.length * ratio);
      const resampled = new Float32Array(newLength);
      
      for (let i = 0; i < newLength; i++) {
        const srcIndex = i / ratio;
        const srcIndexFloor = Math.floor(srcIndex);
        const srcIndexCeil = Math.min(srcIndexFloor + 1, channelData.length - 1);
        const fraction = srcIndex - srcIndexFloor;
        
        resampled[i] = channelData[srcIndexFloor] * (1 - fraction) + 
                       channelData[srcIndexCeil] * fraction;
      }
      
      return resampled;
    }

    return channelData;
  }

  /**
   * Create parameters for Whisper
   */
  private createParams(options: Partial<WhisperConfig>): any {
    // This is a simplified version
    // In the real implementation, we would properly set all parameters
    return {
      n_threads: options.threads || navigator.hardwareConcurrency || 4,
      translate: options.task === 'translate',
      language: options.language || 'en',
      print_progress: false,
      print_timestamps: true,
      token_timestamps: options.wordTimestamps || false,
      temperature: options.temperature || 0.0,
      max_tokens: options.maxTokens || 0,
    };
  }

  /**
   * Extract transcription results from Whisper
   */
  private extractResults(): TranscriptionResult {
    // For now, return a placeholder result
    // In the real implementation with proper bindings, 
    // we would extract the actual segments from the WASM module
    
    return {
      text: "Transcription completed using browser Whisper", // Placeholder
      segments: [
        {
          text: "Transcription completed using browser Whisper",
          start: 0,
          end: 1,
          confidence: 0.95
        }
      ],
      language: 'en',
      duration: 1,
    };
  }

  /**
   * Get the current model info
   */
  getCurrentModel(): WhisperModel | null {
    return this.currentModel;
  }

  /**
   * Check if engine is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Clean up and free resources
   */
  async destroy(): Promise<void> {
    if (this.context && this.module) {
      this.module.free();
      this.context = null;
    }

    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this.module = null;
    this.initialized = false;
    this.currentModel = null;

    console.log('Whisper engine destroyed');
  }

  /**
   * Get performance stats
   */
  async getPerformanceStats(): Promise<{
    modelSize: number;
    memoryUsage: number;
    averageSpeed: number;
  }> {
    const modelInfo = await this.modelManager.getAvailableModels();
    const currentModelInfo = modelInfo.find(m => m.id === this.currentModel);

    return {
      modelSize: currentModelInfo?.size || 0,
      memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
      averageSpeed: 0, // Would need to track this over time
    };
  }
}