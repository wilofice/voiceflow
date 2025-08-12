/**
 * Whisper Web Worker
 * Handles transcription in a background thread to avoid blocking the UI
 */

import type { WhisperConfig, TranscriptionResult } from './whisperEngine';

// Message types for worker communication
export interface WorkerMessage {
  id: string;
  type: 'initialize' | 'transcribe' | 'destroy' | 'getStatus';
  data?: any;
}

export interface WorkerResponse {
  id: string;
  type: 'success' | 'error' | 'progress' | 'status';
  data?: any;
  error?: string;
}

// Worker state
interface WorkerState {
  initialized: boolean;
  currentModel: string | null;
  isProcessing: boolean;
  module: any;
  context: any;
}

// This would be compiled as a separate worker file
const workerCode = `
// Whisper Worker Implementation
let state = {
  initialized: false,
  currentModel: null,
  isProcessing: false,
  module: null,
  context: null,
};

// Import scripts
self.importScripts('/wasm/whisper.js');

// Message handler
self.addEventListener('message', async (event) => {
  const message = event.data;
  const { id, type, data } = message;

  try {
    switch (type) {
      case 'initialize':
        await handleInitialize(id, data);
        break;
      
      case 'transcribe':
        await handleTranscribe(id, data);
        break;
      
      case 'destroy':
        await handleDestroy(id);
        break;
      
      case 'getStatus':
        handleGetStatus(id);
        break;
      
      default:
        throw new Error('Unknown message type: ' + type);
    }
  } catch (error) {
    sendError(id, error.message);
  }
});

async function handleInitialize(id, data) {
  const { model, modelBuffer } = data;
  
  sendProgress(id, { stage: 'loading_module', progress: 0 });
  
  // Load WASM module
  if (!state.module) {
    state.module = await createWhisperModule({
      locateFile: (path) => {
        if (path.endsWith('.wasm')) {
          return '/wasm/' + path;
        }
        return path;
      },
    });
  }
  
  sendProgress(id, { stage: 'loading_model', progress: 30 });
  
  // Initialize context with model
  const modelData = new Uint8Array(modelBuffer);
  const modelPtr = state.module._malloc(modelData.length);
  state.module.HEAPU8.set(modelData, modelPtr);
  
  state.context = state.module.ccall(
    'whisper_init_from_buffer',
    'number',
    ['number', 'number'],
    [modelPtr, modelData.length]
  );
  
  state.module._free(modelPtr);
  
  if (!state.context) {
    throw new Error('Failed to initialize Whisper context');
  }
  
  state.initialized = true;
  state.currentModel = model;
  
  sendProgress(id, { stage: 'complete', progress: 100 });
  sendSuccess(id, { initialized: true, model });
}

async function handleTranscribe(id, data) {
  if (!state.initialized || !state.context) {
    throw new Error('Worker not initialized');
  }
  
  if (state.isProcessing) {
    throw new Error('Already processing');
  }
  
  state.isProcessing = true;
  
  try {
    const { audioData, config } = data;
    const audioFloat32 = new Float32Array(audioData);
    
    sendProgress(id, { stage: 'processing', progress: 0 });
    
    // Allocate memory for audio
    const audioPtr = state.module._malloc(audioFloat32.length * 4);
    state.module.HEAPF32.set(audioFloat32, audioPtr / 4);
    
    // Set up parameters
    const params = createWhisperParams(config);
    
    // Run Whisper
    const result = state.module.ccall(
      'whisper_full',
      'number',
      ['number', 'number', 'number', 'number'],
      [state.context, params, audioPtr, audioFloat32.length]
    );
    
    state.module._free(audioPtr);
    
    if (result !== 0) {
      throw new Error('Whisper processing failed: ' + result);
    }
    
    sendProgress(id, { stage: 'extracting', progress: 80 });
    
    // Extract results
    const transcription = extractResults();
    
    sendProgress(id, { stage: 'complete', progress: 100 });
    sendSuccess(id, transcription);
    
  } finally {
    state.isProcessing = false;
  }
}

async function handleDestroy(id) {
  if (state.context && state.module) {
    state.module.ccall('whisper_free', null, ['number'], [state.context]);
    state.context = null;
  }
  
  state.initialized = false;
  state.currentModel = null;
  state.module = null;
  
  sendSuccess(id, { destroyed: true });
}

function handleGetStatus(id) {
  sendSuccess(id, {
    initialized: state.initialized,
    currentModel: state.currentModel,
    isProcessing: state.isProcessing,
  });
}

function createWhisperParams(config) {
  // Default params
  return {
    n_threads: config.threads || 4,
    translate: config.task === 'translate',
    language: config.language || 'en',
    print_progress: false,
    print_timestamps: true,
  };
}

function extractResults() {
  const segments = [];
  const nSegments = state.module.ccall(
    'whisper_full_n_segments',
    'number',
    ['number'],
    [state.context]
  );
  
  for (let i = 0; i < nSegments; i++) {
    const text = state.module.ccall(
      'whisper_full_get_segment_text',
      'string',
      ['number', 'number'],
      [state.context, i]
    );
    
    const t0 = state.module.ccall(
      'whisper_full_get_segment_t0',
      'number',
      ['number', 'number'],
      [state.context, i]
    );
    
    const t1 = state.module.ccall(
      'whisper_full_get_segment_t1',
      'number',
      ['number', 'number'],
      [state.context, i]
    );
    
    segments.push({
      text: text.trim(),
      start: t0 / 100,
      end: t1 / 100,
    });
  }
  
  return {
    text: segments.map(s => s.text).join(' '),
    segments: segments,
  };
}

function sendSuccess(id, data) {
  self.postMessage({ id, type: 'success', data });
}

function sendError(id, error) {
  self.postMessage({ id, type: 'error', error });
}

function sendProgress(id, data) {
  self.postMessage({ id, type: 'progress', data });
}
`;

/**
 * WhisperWorkerManager
 * Manages the Web Worker for background transcription
 */
export class WhisperWorkerManager {
  private worker: Worker | null = null;
  private messageId = 0;
  private pendingMessages = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }>();
  private progressCallbacks = new Map<string, (progress: any) => void>();

  constructor() {
    this.initializeWorker();
  }

  /**
   * Initialize the worker
   */
  private initializeWorker(): void {
    // Create worker from blob
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    
    this.worker = new Worker(workerUrl);
    
    // Set up message handler
    this.worker.addEventListener('message', (event) => {
      const response: WorkerResponse = event.data;
      const { id, type, data, error } = response;
      
      if (type === 'progress') {
        const callback = this.progressCallbacks.get(id);
        if (callback) {
          callback(data);
        }
        return;
      }
      
      const pending = this.pendingMessages.get(id);
      if (pending) {
        if (type === 'success') {
          pending.resolve(data);
        } else if (type === 'error') {
          pending.reject(new Error(error || 'Unknown error'));
        }
        this.pendingMessages.delete(id);
        this.progressCallbacks.delete(id);
      }
    });
    
    // Set up error handler
    this.worker.addEventListener('error', (error) => {
      console.error('Worker error:', error);
      // Reject all pending messages
      for (const [id, pending] of this.pendingMessages) {
        pending.reject(error);
      }
      this.pendingMessages.clear();
      this.progressCallbacks.clear();
    });
  }

  /**
   * Send a message to the worker
   */
  private async sendMessage(
    type: WorkerMessage['type'],
    data?: any,
    onProgress?: (progress: any) => void
  ): Promise<any> {
    if (!this.worker) {
      throw new Error('Worker not initialized');
    }

    const id = `msg_${++this.messageId}`;
    
    if (onProgress) {
      this.progressCallbacks.set(id, onProgress);
    }

    return new Promise((resolve, reject) => {
      this.pendingMessages.set(id, { resolve, reject });
      
      const message: WorkerMessage = { id, type, data };
      this.worker!.postMessage(message, 
        // Transfer ArrayBuffers for better performance
        data?.modelBuffer ? [data.modelBuffer] : 
        data?.audioData ? [data.audioData.buffer] : 
        undefined
      );
    });
  }

  /**
   * Initialize Whisper in the worker
   */
  async initialize(
    model: string,
    modelBuffer: ArrayBuffer,
    onProgress?: (progress: any) => void
  ): Promise<void> {
    await this.sendMessage('initialize', { model, modelBuffer }, onProgress);
  }

  /**
   * Transcribe audio in the worker
   */
  async transcribe(
    audioData: Float32Array,
    config?: Partial<WhisperConfig>,
    onProgress?: (progress: any) => void
  ): Promise<TranscriptionResult> {
    // Clone the audio data to transfer
    const audioBuffer = audioData.buffer.slice(0);
    
    return await this.sendMessage(
      'transcribe',
      { audioData: audioBuffer, config },
      onProgress
    );
  }

  /**
   * Get worker status
   */
  async getStatus(): Promise<{
    initialized: boolean;
    currentModel: string | null;
    isProcessing: boolean;
  }> {
    return await this.sendMessage('getStatus');
  }

  /**
   * Destroy the worker
   */
  async destroy(): Promise<void> {
    await this.sendMessage('destroy');
    
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    
    this.pendingMessages.clear();
    this.progressCallbacks.clear();
  }
}

// Export a function to create the worker file
export function createWorkerFile(): Blob {
  return new Blob([workerCode], { type: 'application/javascript' });
}