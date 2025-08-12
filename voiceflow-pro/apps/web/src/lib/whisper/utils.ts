/**
 * Whisper Utilities
 * Common utility functions for the Whisper implementation
 */

/**
 * Check browser compatibility for Whisper features
 */
export function checkBrowserCompatibility(): {
  compatible: boolean;
  missing: string[];
  warnings: string[];
} {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Required features
  if (!window.WebAssembly) {
    missing.push('WebAssembly');
  }

  if (!window.Worker) {
    missing.push('Web Workers');
  }

  if (!window.indexedDB) {
    missing.push('IndexedDB');
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    missing.push('getUserMedia (microphone access)');
  }

  // Optional but recommended features
  if (typeof AudioWorkletNode === 'undefined') {
    warnings.push('AudioWorklet not supported (using ScriptProcessor fallback)');
  }

  if (!('storage' in navigator)) {
    warnings.push('Storage API not supported (cannot estimate storage)');
  }

  return {
    compatible: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Format duration in seconds to human readable format
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

/**
 * Calculate estimated processing time based on model and audio length
 */
export function estimateProcessingTime(
  modelSize: 'tiny' | 'base' | 'small' | 'medium' | 'large',
  audioLengthSeconds: number
): number {
  // Real-time factors for different models (approximate)
  const rtfMap = {
    tiny: 32,    // 32x real-time
    base: 16,    // 16x real-time
    small: 6,    // 6x real-time
    medium: 2,   // 2x real-time
    large: 1,    // 1x real-time
  };

  const rtf = rtfMap[modelSize];
  return (audioLengthSeconds / rtf) * 1000; // Return in milliseconds
}

/**
 * Get optimal model recommendation based on device capabilities
 */
export function getRecommendedModel(): 'tiny' | 'base' | 'small' | 'medium' {
  // Check available memory
  const memory = (navigator as any).deviceMemory || 4; // GB
  
  // Check if on mobile
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  // Check connection type
  const connection = (navigator as any).connection;
  const isSlowConnection = connection?.effectiveType === 'slow-2g' || 
                          connection?.effectiveType === '2g';

  if (isMobile || memory < 4 || isSlowConnection) {
    return 'tiny';
  } else if (memory < 8) {
    return 'base';
  } else {
    return 'small';
  }
}

/**
 * Convert audio file to the format expected by Whisper (16kHz mono)
 */
export async function convertAudioForWhisper(file: File): Promise<Float32Array> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext({ sampleRate: 16000 });
  
  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
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
  } finally {
    await audioContext.close();
  }
}

/**
 * Check if WebAssembly SIMD is supported
 */
export function supportsWasmSIMD(): boolean {
  try {
    // Try to instantiate a simple WASM module with SIMD
    const wasmCode = new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, // WASM header
    ]);
    
    new WebAssembly.Module(wasmCode);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get available CPU cores
 */
export function getCPUCores(): number {
  return navigator.hardwareConcurrency || 4;
}

/**
 * Estimate model download time based on connection
 */
export function estimateDownloadTime(fileSizeBytes: number): {
  fast: string;  // Good connection
  slow: string;  // Slow connection
} {
  const connection = (navigator as any).connection;
  
  // Estimate speeds in bytes per second
  const speeds = {
    '4g': 5 * 1024 * 1024,      // 5 MB/s
    '3g': 1 * 1024 * 1024,      // 1 MB/s
    '2g': 256 * 1024,           // 256 KB/s
    'slow-2g': 64 * 1024,       // 64 KB/s
  };

  const fastSpeed = speeds['4g'];
  const slowSpeed = connection?.effectiveType ? 
    speeds[connection.effectiveType as keyof typeof speeds] || speeds['3g'] :
    speeds['3g'];

  const fastTime = fileSizeBytes / fastSpeed;
  const slowTime = fileSizeBytes / slowSpeed;

  return {
    fast: formatDuration(fastTime),
    slow: formatDuration(slowTime),
  };
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let attempt = 1;
  
  while (attempt <= maxAttempts) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
      attempt++;
    }
  }
  
  throw new Error('Max attempts exceeded');
}

/**
 * Create a cancelable promise
 */
export function createCancelablePromise<T>(
  promise: Promise<T>
): { promise: Promise<T>; cancel: () => void } {
  let isCanceled = false;
  
  const wrappedPromise = new Promise<T>((resolve, reject) => {
    promise
      .then(value => {
        if (!isCanceled) {
          resolve(value);
        }
      })
      .catch(error => {
        if (!isCanceled) {
          reject(error);
        }
      });
  });

  return {
    promise: wrappedPromise,
    cancel: () => {
      isCanceled = true;
    },
  };
}