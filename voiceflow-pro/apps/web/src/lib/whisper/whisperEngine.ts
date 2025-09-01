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
    createWhisperModule?: (config?: any) => Promise<any>;
    whisper_factory?: () => Promise<any>;
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
    try {
      console.log('Loading Whisper WASM module...');
      
      // Check SharedArrayBuffer availability
      const hasSharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined';
      console.log(`SharedArrayBuffer support: ${hasSharedArrayBuffer ? '✓' : '✗'}`);
      
      // Provide a polyfill or alternative for missing SharedArrayBuffer
      if (!hasSharedArrayBuffer) {
        console.log('Providing SharedArrayBuffer polyfill...');
        // Create a simple polyfill that falls back to regular ArrayBuffer
        (window as any).SharedArrayBuffer = ArrayBuffer;
      }
      
      // Load the whisper WASM module
      await this.loadScript('/wasm/whisper.js');
      
      // Wait for module to be available
      if (!window.Module) {
        throw new Error('Module global not found after loading whisper.js');
      }
      
      const module = window.Module;
      console.log('Module loaded, initializing...');
      
      // Wait for runtime initialization with proper error handling
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WASM module initialization timed out after 30 seconds'));
        }, 30000);
        
        try {
          if (module.calledRun) {
            clearTimeout(timeout);
            resolve();
            return;
          }
          
          const originalCallback = module.onRuntimeInitialized;
          module.onRuntimeInitialized = () => {
            clearTimeout(timeout);
            try {
              if (originalCallback) originalCallback();
              console.log('✓ WASM runtime initialized');
              resolve();
            } catch (err) {
              reject(err);
            }
          };
          
          // Fallback for modules that might not have onRuntimeInitialized
          if (typeof module.onRuntimeInitialized === 'undefined') {
            clearTimeout(timeout);
            resolve();
          }
        } catch (err) {
          clearTimeout(timeout);
          reject(err);
        }
      });
      
      this.module = module;
      console.log('✅ Whisper WASM module loaded and ready');
      
      // Log available methods for debugging
      const methods = Object.keys(this.module).filter(k => typeof this.module[k] === 'function');
      console.log(`Available methods (${methods.length}):`, methods.slice(0, 10).join(', ') + (methods.length > 10 ? '...' : ''));
        
    } catch (error) {
      console.error('❌ Failed to load Whisper module:', error);
      
      // Clean up polyfill if we added it
      if (typeof SharedArrayBuffer === 'undefined' && (window as any).SharedArrayBuffer === ArrayBuffer) {
        delete (window as any).SharedArrayBuffer;
      }
      
      throw new Error(`Whisper initialization failed: ${error.message}`);
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
      console.log(`Starting transcription of ${audioData.length} samples (${audioData.length / 16000}s of audio)`);
      
      // Ensure audio is mono and at 16kHz
      const processedAudio = await this.preprocessAudio(audioData);
      
      // Validate audio data
      if (!processedAudio || processedAudio.length === 0) {
        throw new Error('Processed audio data is empty');
      }
      
      console.log(`Processed audio: ${processedAudio.length} samples`);

      // Check if full_default function exists
      if (typeof this.module.full_default !== 'function') {
        console.error('Available module methods:', Object.keys(this.module).filter(k => typeof this.module[k] === 'function'));
        throw new Error('full_default function not found in WASM module');
      }

      // Run whisper transcription
      const language = options.language || 'en';
      const translate = options.task === 'translate' || false;
      
      console.log(`Running Whisper transcription (language: ${language}, translate: ${translate})`);
      
      // Call the WASM function with the correct parameters
      const result = this.module.full_default(processedAudio, language, translate);

      if (result !== 0) {
        throw new Error(`Whisper processing failed with code: ${result}`);
      }
      
      console.log('Whisper transcription completed successfully');

      // Extract results from the module
      const transcription = this.extractResults();
      
      const processingTime = performance.now() - startTime;
      transcription.processingTime = processingTime;
      
      console.log(`Transcription completed in ${processingTime}ms`);

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
      // Use default sample rate for audio context, we'll resample later
      this.audioContext = new AudioContext();
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
    try {
      console.log(`Processing audio file: ${file.name}, size: ${file.size}, type: ${file.type}`);
      
      const arrayBuffer = await file.arrayBuffer();
      
      // Create AudioContext with default sample rate first for decoding
      if (!this.audioContext) {
        // Don't specify sample rate for decoding, let it use the default
        this.audioContext = new AudioContext();
      }

      console.log('Decoding audio data...');
      let audioBuffer: AudioBuffer;
      
      try {
        audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer.slice(0));
      } catch (decodeError) {
        console.error('Failed to decode audio data:', decodeError);
        console.log('Attempting alternative decoding method...');
        
        // Try creating a new context without constraints
        const tempContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        try {
          audioBuffer = await tempContext.decodeAudioData(arrayBuffer.slice(0));
        } finally {
          await tempContext.close();
        }
      }
      
      console.log(`Audio decoded: channels=${audioBuffer.numberOfChannels}, sampleRate=${audioBuffer.sampleRate}, length=${audioBuffer.length}`);
      
      // Convert to mono if stereo
      let channelData: Float32Array;
      if (audioBuffer.numberOfChannels > 1) {
        console.log('Converting stereo to mono...');
        channelData = new Float32Array(audioBuffer.length);
        for (let i = 0; i < audioBuffer.length; i++) {
          let sum = 0;
          for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            sum += audioBuffer.getChannelData(channel)[i];
          }
          channelData[i] = sum / audioBuffer.numberOfChannels;
        }
      } else {
        channelData = new Float32Array(audioBuffer.getChannelData(0));
      }

      // Resample to 16kHz if needed
      if (audioBuffer.sampleRate !== 16000) {
        console.log(`Resampling from ${audioBuffer.sampleRate}Hz to 16000Hz...`);
        const ratio = 16000 / audioBuffer.sampleRate;
        const newLength = Math.floor(channelData.length * ratio);
        const resampled = new Float32Array(newLength);
        
        // Use linear interpolation for resampling
        for (let i = 0; i < newLength; i++) {
          const srcIndex = i / ratio;
          const srcIndexFloor = Math.floor(srcIndex);
          const srcIndexCeil = Math.min(srcIndexFloor + 1, channelData.length - 1);
          const fraction = srcIndex - srcIndexFloor;
          
          resampled[i] = channelData[srcIndexFloor] * (1 - fraction) + 
                         channelData[srcIndexCeil] * fraction;
        }
        
        console.log(`Resampled audio length: ${resampled.length} samples (${resampled.length / 16000}s)`);
        return resampled;
      }

      console.log(`Audio data ready: ${channelData.length} samples (${channelData.length / 16000}s)`);
      return channelData;
      
    } catch (error) {
      console.error('Failed to process audio file:', error);
      throw new Error(`Unable to decode audio data: ${error.message}`);
    }
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
    if (!this.module) {
      throw new Error('Module not initialized');
    }
    
    try {
      // Get the number of segments
      const n_segments = this.module.get_n_segments ? this.module.get_n_segments() : 0;
      console.log(`Extracting ${n_segments} segments from transcription`);
      
      const segments: TranscriptionSegment[] = [];
      let fullText = '';
      
      if (n_segments > 0) {
        // Extract each segment
        for (let i = 0; i < n_segments; i++) {
          const text = this.module.get_segment_text ? this.module.get_segment_text(i) : '';
          const t0 = this.module.get_segment_t0 ? this.module.get_segment_t0(i) : 0;
          const t1 = this.module.get_segment_t1 ? this.module.get_segment_t1(i) : 0;
          
          // Convert timestamps from centiseconds to seconds
          const start = t0 / 100;
          const end = t1 / 100;
          
          if (text && text.trim()) {
            segments.push({
              text: text.trim(),
              start,
              end,
              confidence: 0.95 // Whisper doesn't provide confidence scores directly
            });
            
            fullText += text + ' ';
          }
        }
      }
      
      // If no segments were extracted, try to get the full text directly
      if (segments.length === 0 && this.module.get_text) {
        fullText = this.module.get_text() || '';
        if (fullText) {
          segments.push({
            text: fullText.trim(),
            start: 0,
            end: 0,
            confidence: 0.95
          });
        }
      }
      
      // Fallback if still no text
      if (!fullText) {
        console.warn('No transcription text extracted from Whisper');
        fullText = '[No speech detected]';
        segments.push({
          text: fullText,
          start: 0,
          end: 0,
          confidence: 0
        });
      }
      
      return {
        text: fullText.trim(),
        segments,
        language: this.module.get_language ? this.module.get_language() : 'en',
        duration: segments.length > 0 ? segments[segments.length - 1].end : 0,
      };
      
    } catch (error) {
      console.error('Failed to extract results:', error);
      
      // Return a fallback result
      return {
        text: '[Transcription extraction failed]',
        segments: [{
          text: '[Transcription extraction failed]',
          start: 0,
          end: 0,
          confidence: 0
        }],
        language: 'en',
        duration: 0,
      };
    }
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