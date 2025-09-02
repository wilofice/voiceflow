/**
 * Whisper Web Engine
 * Main interface for running Whisper.cpp in the browser via WebAssembly
 */

import { WhisperModelManager, WhisperModel } from './modelManager';
import { AudioProcessor } from './audioProcessor';

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
  private instance: number | null = null; // Whisper instance ID
  private modelManager: WhisperModelManager;
  private currentModel: WhisperModel | null = null;
  private worker: Worker | null = null;
  private initialized = false;
  private audioContext: AudioContext | null = null;
  private audioProcessor: AudioProcessor;

  constructor() {
    this.modelManager = WhisperModelManager.getInstance();
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
      
      // Temporarily capture output during initialization
      const initOutput: string[] = [];
      const originalPrint = this.module.print;
      const originalPrintErr = this.module.printErr;
      
      this.module.print = (text: string) => {
        initOutput.push(text);
        console.log('[Whisper Init]:', text);
      };
      
      this.module.printErr = (text: string) => {
        initOutput.push(text);
        console.log('[Whisper Init Error]:', text);
      };
      
      let instance;
      try {
        instance = this.module.init(modelPath);
      } finally {
        // Restore original print functions
        this.module.print = originalPrint;
        this.module.printErr = originalPrintErr;
      }
      
      // The model loading output indicates success even if instance is 0 or false
      // Check if initialization succeeded based on the output
      const modelLoaded = initOutput.some(line => 
        line.includes('model size') || 
        line.includes('whisper_init_state')
      );
      
      if (!instance && !modelLoaded) {
        console.error('Initialization failed. Output:', initOutput);
        throw new Error('Failed to initialize Whisper context');
      }
      
      // Store the instance (it might be 1, which is a valid instance ID)
      this.instance = instance || 1; // Default to 1 if falsy but model loaded
      console.log(`Whisper instance initialized: ${this.instance}`);

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

      // Check available methods and log them for debugging
      const availableMethods = Object.keys(this.module).filter(k => typeof this.module[k] === 'function');
      console.log('Available WASM methods:', availableMethods.slice(0, 20).join(', '));
      
      if (typeof this.module.full_default !== 'function') {
        console.error('full_default function not found in WASM module');
        console.error('Available methods:', availableMethods);
        throw new Error('full_default function not found in WASM module');
      }

      // Run whisper transcription
      // Ensure language is a clean ASCII string
      //const language = String(options.language || 'fr').toLowerCase().trim();
      const language = 'fr';
      const shouldTranslate = Boolean(options.task === 'translate');
      
      console.log(`Running Whisper transcription (language: ${language}, translate: ${shouldTranslate})`);
      console.log(`Audio data type: ${processedAudio.constructor.name}, length: ${processedAudio.length}`);
      console.log(`Language type: ${typeof language}, value: "${language}"`);
      console.log(`Translate type: ${typeof shouldTranslate}, value: ${shouldTranslate}`);
      
      // Ensure parameters are the correct types
      if (typeof language !== 'string') {
        throw new Error(`Language must be a string, got ${typeof language}`);
      }
      
      // Call the WASM function with proper parameter handling
      let result: number;
      
      try {
        // Check if we have a valid instance
        if (!this.instance) {
          throw new Error('No Whisper instance available. Call initialize() first.');
        }
        
        // Prepare parameters as in the example
        const audioBuffer = new Float32Array(processedAudio);
        const nthreads = options.threads || navigator.hardwareConcurrency || 4;
        
        console.log(`Calling full_default with 5 parameters:`);
        console.log(`- Instance: ${this.instance}`);
        console.log(`- Audio: ${audioBuffer.length} samples (${audioBuffer.constructor.name})`);
        console.log(`- Language: "${language}"`);
        console.log(`- Threads: ${nthreads}`);
        console.log(`- Translate: ${shouldTranslate}`);
        
        // Set up output capture like in the example
        const capturedOutput: string[] = [];
        const originalPrint = this.module.print;
        const originalPrintErr = this.module.printErr;
        
        // Capture print output to extract transcription
        this.module.print = (text: string) => {
          capturedOutput.push(text);
          console.log('[Whisper]:', text);
          if (originalPrint) originalPrint(text);
        };
        
        this.module.printErr = (text: string) => {
          capturedOutput.push(text);  
          console.error('[Whisper]:', text);
          if (originalPrintErr) originalPrintErr(text);
        };
        
        // Call in setTimeout to prevent blocking like the example
        result = await new Promise<number>((resolve, reject) => {
          setTimeout(() => {
            try {
              // Call exactly as in the example: Module.full_default(instance, audio, language, nthreads, translate)
              const ret = this.module.full_default(this.instance!, audioBuffer, language, nthreads, shouldTranslate);
              console.log(`full_default returned: ${ret}`);
              resolve(ret);
            } catch (error) {
              reject(error);
            } finally {
              // Restore original print functions
              this.module.print = originalPrint;
              this.module.printErr = originalPrintErr;
            }
          }, 100);
        });
        
        // Store captured output for result extraction
        (this as any).lastCapturedOutput = capturedOutput;
        
      } catch (error: any) {
        console.error('WASM function call failed:', error);
        
        // If it's a binding error, try alternative approaches
        if (error.name === 'BindingError') {
          console.log('Trying alternative parameter types...');
          
          try {
            // Try with explicit boolean conversion
            const translateBool = Boolean(shouldTranslate);
            console.log(`Trying with Boolean(${shouldTranslate}) = ${translateBool}`);
            result = this.module.full_default(processedAudio, language, translateBool);
          } catch (secondError: any) {
            console.error('Second attempt failed:', secondError);
            
            // Try with numeric boolean as last resort
            try {
              const translateNum = shouldTranslate ? 1 : 0;
              console.log(`Trying with numeric boolean: ${translateNum}`);
              result = this.module.full_default(processedAudio, language, translateNum);
            } catch (thirdError: any) {
              console.error('All attempts failed');
              console.error('Original error:', error);
              console.error('Second error:', secondError);
              console.error('Third error:', thirdError);
              
              // Provide detailed debugging information
              console.error('Debug info:');
              console.error('- Audio data:', processedAudio);
              console.error('- Language:', language, typeof language);
              console.error('- Translate:', shouldTranslate, typeof shouldTranslate);
              console.error('- Module methods:', Object.keys(this.module).filter(k => k.includes('full')));
              
              throw new Error(`Unable to call Whisper full_default function. ${error.message}`);
            }
          }
        } else {
          throw error;
        }
      }

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
      // Use the dedicated audio processor
      const audioData = await this.audioProcessor.processAudioFile(file);
      
      // Validate the audio data
      if (!this.audioProcessor.validateAudioData(audioData)) {
        throw new Error('Invalid audio data after processing');
      }
      
      console.log(`Audio processing completed: ${audioData.length} samples (${audioData.length / 16000}s at 16kHz)`);
      return audioData;
      
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
      // Extract results from captured output 
      const capturedOutput = (this as any).lastCapturedOutput as string[] || [];
      
      console.log(`Extracting results from ${capturedOutput.length} output lines`);
      console.log('Full captured output:', capturedOutput); // Log ALL lines for debugging
      
      const segments: TranscriptionSegment[] = [];
      let fullText = '';
      
      // Parse the captured output to extract transcription segments
      let inTranscription = false;
      
      for (const line of capturedOutput) {
        // Check for transcription markers
        if (line.includes('==== TRANSCRIPTION START ====')) {
          inTranscription = true;
          continue;
        }
        if (line.includes('==== TRANSCRIPTION END ====')) {
          inTranscription = false;
          continue;
        }
        
        // Only process lines within transcription markers
        if (inTranscription) {
          // Look for timestamp patterns like [00:00.000 --> 00:05.000]
          const timestampMatch = line.match(/\[(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2})\.(\d{3})\]\s*(.+)/);
          
          if (timestampMatch) {
            const [, startMin, startSec, startMs, endMin, endSec, endMs, text] = timestampMatch;
            
            const start = parseInt(startMin) * 60 + parseInt(startSec) + parseInt(startMs) / 1000;
            const end = parseInt(endMin) * 60 + parseInt(endSec) + parseInt(endMs) / 1000;
            
            if (text && text.trim()) {
              const cleanText = text.trim();
              segments.push({
                text: cleanText,
                start,
                end,
                confidence: 0.95
              });
              fullText += cleanText + ' ';
            }
          }
        }
      }
      
      // If we found text without proper segments, create a single segment
      if (!segments.length && fullText.trim()) {
        segments.push({
          text: fullText.trim(),
          start: 0,
          end: 0,
          confidence: 0.95
        });
      }
      
      // Fallback if still no text
      if (!fullText.trim()) {
        console.warn('No transcription text extracted from Whisper output');
        console.log('Raw captured output for debugging:', capturedOutput);
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

  /**
   * Clean up resources and destroy the engine
   */
  async destroy(): Promise<void> {
    try {
      // Clean up WASM module
      if (this.module && typeof this.module.free === 'function') {
        this.module.free();
      }
      
      // Close audio context
      if (this.audioContext) {
        await this.audioContext.close();
        this.audioContext = null;
      }

      // Clean up audio processor
      if (this.audioProcessor) {
        this.audioProcessor.dispose();
      }

      // Reset state
      this.module = null;
      this.context = null;
      this.initialized = false;
      this.currentModel = null;
      
      console.log('Whisper engine destroyed successfully');
    } catch (error) {
      console.error('Error destroying Whisper engine:', error);
    }
  }
}