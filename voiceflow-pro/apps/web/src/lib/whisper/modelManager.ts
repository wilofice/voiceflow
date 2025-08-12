/**
 * Whisper Model Manager
 * Handles downloading, caching, and versioning of Whisper models using IndexedDB
 */

import { EventEmitter } from 'events';

export type WhisperModel = 'tiny' | 'tiny.en' | 'base' | 'base.en' | 'small' | 'small.en' | 'medium' | 'medium.en' | 'large-v3';

export interface ModelInfo {
  id: WhisperModel;
  name: string;
  size: number;
  sizeFormatted: string;
  language: 'multilingual' | 'english';
  description: string;
  accuracy: string;
  speed: string;
  downloaded?: boolean;
  downloadProgress?: number;
  lastUsed?: Date;
  version?: string;
}

export interface StorageInfo {
  used: number;
  available: number;
  quota: number;
  models: {
    id: WhisperModel;
    size: number;
    lastAccessed: Date;
  }[];
}

export interface DownloadProgress {
  modelId: WhisperModel;
  progress: number;
  downloaded: number;
  total: number;
  speed: number;
  timeRemaining: number;
  status: 'downloading' | 'processing' | 'complete' | 'error';
  error?: string;
}

// Model metadata
const MODEL_METADATA: Record<WhisperModel, ModelInfo> = {
  'tiny': {
    id: 'tiny',
    name: 'Tiny',
    size: 39321600,
    sizeFormatted: '39 MB',
    language: 'multilingual',
    description: 'Fastest model, suitable for real-time transcription',
    accuracy: '~85%',
    speed: '~32x realtime',
  },
  'tiny.en': {
    id: 'tiny.en',
    name: 'Tiny (English)',
    size: 39321600,
    sizeFormatted: '39 MB',
    language: 'english',
    description: 'English-only tiny model, slightly better for English',
    accuracy: '~87%',
    speed: '~32x realtime',
  },
  'base': {
    id: 'base',
    name: 'Base',
    size: 148897600,
    sizeFormatted: '142 MB',
    language: 'multilingual',
    description: 'Good balance of speed and accuracy',
    accuracy: '~91%',
    speed: '~16x realtime',
  },
  'base.en': {
    id: 'base.en',
    name: 'Base (English)',
    size: 148897600,
    sizeFormatted: '142 MB',
    language: 'english',
    description: 'English-only base model',
    accuracy: '~93%',
    speed: '~16x realtime',
  },
  'small': {
    id: 'small',
    name: 'Small',
    size: 488380800,
    sizeFormatted: '466 MB',
    language: 'multilingual',
    description: 'Good accuracy for general use',
    accuracy: '~94%',
    speed: '~6x realtime',
  },
  'small.en': {
    id: 'small.en',
    name: 'Small (English)',
    size: 488380800,
    sizeFormatted: '466 MB',
    language: 'english',
    description: 'English-only small model',
    accuracy: '~95%',
    speed: '~6x realtime',
  },
  'medium': {
    id: 'medium',
    name: 'Medium',
    size: 1611661312,
    sizeFormatted: '1.5 GB',
    language: 'multilingual',
    description: 'High accuracy for professional use',
    accuracy: '~96%',
    speed: '~2x realtime',
  },
  'medium.en': {
    id: 'medium.en',
    name: 'Medium (English)',
    size: 1611661312,
    sizeFormatted: '1.5 GB',
    language: 'english',
    description: 'English-only medium model',
    accuracy: '~97%',
    speed: '~2x realtime',
  },
  'large-v3': {
    id: 'large-v3',
    name: 'Large v3',
    size: 3321675776,
    sizeFormatted: '3.1 GB',
    language: 'multilingual',
    description: 'Highest accuracy, latest version',
    accuracy: '~98%',
    speed: '~1x realtime',
  },
};

export class WhisperModelManager extends EventEmitter {
  private static instance: WhisperModelManager;
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'whisper-models';
  private readonly DB_VERSION = 1;
  private readonly STORE_NAME = 'models';
  private readonly CDN_BASE_URL = process.env.NEXT_PUBLIC_MODEL_CDN_URL || '/models';
  private downloadControllers = new Map<WhisperModel, AbortController>();

  private constructor() {
    super();
    this.initializeDB();
  }

  static getInstance(): WhisperModelManager {
    if (!WhisperModelManager.instance) {
      WhisperModelManager.instance = new WhisperModelManager();
    }
    return WhisperModelManager.instance;
  }

  /**
   * Initialize IndexedDB
   */
  private async initializeDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object store for models
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
          store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
          store.createIndex('size', 'size', { unique: false });
        }
      };
    });
  }

  /**
   * Get all available models with their download status
   */
  async getAvailableModels(): Promise<ModelInfo[]> {
    const models = Object.values(MODEL_METADATA);
    
    // Check which models are downloaded
    for (const model of models) {
      const cached = await this.getCachedModel(model.id);
      model.downloaded = cached !== null;
    }

    return models;
  }

  /**
   * Download a model with progress tracking
   */
  async downloadModel(
    modelType: WhisperModel,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<ArrayBuffer> {
    // Check if already downloading
    if (this.downloadControllers.has(modelType)) {
      throw new Error(`Model ${modelType} is already being downloaded`);
    }

    // Check if already cached
    const cached = await this.getCachedModel(modelType);
    if (cached) {
      console.log(`Model ${modelType} already cached`);
      return cached;
    }

    const modelInfo = MODEL_METADATA[modelType];
    if (!modelInfo) {
      throw new Error(`Unknown model type: ${modelType}`);
    }

    const controller = new AbortController();
    this.downloadControllers.set(modelType, controller);

    try {
      const modelUrl = `${this.CDN_BASE_URL}/ggml-${modelType}.bin`;
      console.log(`Downloading model from: ${modelUrl}`);

      const startTime = Date.now();
      let lastTime = startTime;
      let lastLoaded = 0;

      const response = await fetch(modelUrl, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to download model: ${response.statusText}`);
      }

      const contentLength = Number(response.headers.get('content-length'));
      const reader = response.body!.getReader();
      const chunks: Uint8Array[] = [];
      let loaded = 0;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        loaded += value.length;

        // Calculate progress
        const now = Date.now();
        const timeDiff = (now - lastTime) / 1000; // seconds
        const bytesDiff = loaded - lastLoaded;
        const speed = bytesDiff / timeDiff; // bytes per second
        const timeRemaining = (contentLength - loaded) / speed; // seconds

        lastTime = now;
        lastLoaded = loaded;

        const progress: DownloadProgress = {
          modelId: modelType,
          progress: (loaded / contentLength) * 100,
          downloaded: loaded,
          total: contentLength,
          speed: speed,
          timeRemaining: timeRemaining,
          status: 'downloading',
        };

        onProgress?.(progress);
        this.emit('downloadProgress', progress);
      }

      // Combine chunks into single ArrayBuffer
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }

      const arrayBuffer = result.buffer;

      // Cache the model
      await this.cacheModel(modelType, arrayBuffer);

      // Emit completion
      const completeProgress: DownloadProgress = {
        modelId: modelType,
        progress: 100,
        downloaded: contentLength,
        total: contentLength,
        speed: 0,
        timeRemaining: 0,
        status: 'complete',
      };

      onProgress?.(completeProgress);
      this.emit('downloadComplete', { modelId: modelType });

      return arrayBuffer;

    } catch (error: any) {
      // Emit error
      const errorProgress: DownloadProgress = {
        modelId: modelType,
        progress: 0,
        downloaded: 0,
        total: 0,
        speed: 0,
        timeRemaining: 0,
        status: 'error',
        error: error.message,
      };

      onProgress?.(errorProgress);
      this.emit('downloadError', { modelId: modelType, error });

      throw error;
    } finally {
      this.downloadControllers.delete(modelType);
    }
  }

  /**
   * Cancel a download in progress
   */
  cancelDownload(modelType: WhisperModel): void {
    const controller = this.downloadControllers.get(modelType);
    if (controller) {
      controller.abort();
      this.downloadControllers.delete(modelType);
      this.emit('downloadCancelled', { modelId: modelType });
    }
  }

  /**
   * Get a cached model from IndexedDB
   */
  async getCachedModel(modelType: WhisperModel): Promise<ArrayBuffer | null> {
    if (!this.db) {
      await this.initializeDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(modelType);

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          // Update last accessed time
          this.updateLastAccessed(modelType);
          resolve(result.data);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Cache a model in IndexedDB
   */
  private async cacheModel(modelType: WhisperModel, data: ArrayBuffer): Promise<void> {
    if (!this.db) {
      await this.initializeDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      
      const modelData = {
        id: modelType,
        data: data,
        size: data.byteLength,
        lastAccessed: new Date(),
        version: MODEL_METADATA[modelType].version || '1.0.0',
        metadata: MODEL_METADATA[modelType],
      };

      const request = store.put(modelData);

      request.onsuccess = () => {
        console.log(`Model ${modelType} cached successfully`);
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Delete a cached model
   */
  async deleteModel(modelType: WhisperModel): Promise<void> {
    if (!this.db) {
      await this.initializeDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.delete(modelType);

      request.onsuccess = () => {
        console.log(`Model ${modelType} deleted`);
        this.emit('modelDeleted', { modelId: modelType });
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Update last accessed timestamp
   */
  private async updateLastAccessed(modelType: WhisperModel): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
    const store = transaction.objectStore(this.STORE_NAME);
    const getRequest = store.get(modelType);

    getRequest.onsuccess = () => {
      const data = getRequest.result;
      if (data) {
        data.lastAccessed = new Date();
        store.put(data);
      }
    };
  }

  /**
   * Get storage information
   */
  async getStorageInfo(): Promise<StorageInfo> {
    const storageEstimate = await navigator.storage.estimate();
    const models: StorageInfo['models'] = [];

    if (this.db) {
      const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.openCursor();

      await new Promise<void>((resolve) => {
        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            models.push({
              id: cursor.value.id,
              size: cursor.value.size,
              lastAccessed: cursor.value.lastAccessed,
            });
            cursor.continue();
          } else {
            resolve();
          }
        };
      });
    }

    return {
      used: storageEstimate.usage || 0,
      available: (storageEstimate.quota || 0) - (storageEstimate.usage || 0),
      quota: storageEstimate.quota || 0,
      models,
    };
  }

  /**
   * Clear all cached models
   */
  async clearAllModels(): Promise<void> {
    if (!this.db) {
      await this.initializeDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('All models cleared');
        this.emit('allModelsCleared');
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Preload models based on user preferences
   */
  async preloadModels(modelTypes: WhisperModel[]): Promise<void> {
    for (const modelType of modelTypes) {
      try {
        await this.downloadModel(modelType);
      } catch (error) {
        console.warn(`Failed to preload model ${modelType}:`, error);
      }
    }
  }

  /**
   * Check if storage quota is sufficient for a model
   */
  async hasStorageSpace(modelType: WhisperModel): Promise<boolean> {
    const modelInfo = MODEL_METADATA[modelType];
    const storageInfo = await this.getStorageInfo();
    
    return storageInfo.available >= modelInfo.size;
  }

  /**
   * Get recommended model based on device capabilities
   */
  getRecommendedModel(): WhisperModel {
    // Check available memory
    const memory = (navigator as any).deviceMemory || 4; // GB
    
    // Check if on mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

    if (isMobile || memory < 4) {
      return 'tiny';
    } else if (memory < 8) {
      return 'base';
    } else {
      return 'small';
    }
  }
}