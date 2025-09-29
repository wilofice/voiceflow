import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Define the API interface that will be exposed to the renderer
interface ElectronAPI {
  // App APIs
  app: {
    getVersion: () => Promise<string>;
    getInfo: () => Promise<any>;
    showAbout: () => Promise<any>;
    openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
  };

  // Whisper APIs
  whisper: {
    initializeModel: (config: any) => Promise<{ success: boolean; error?: string }>;
    transcribeFile: (filePath: string, config: any) => Promise<{ success: boolean; result?: any; error?: string }>;
    getProcessingJobs: () => Promise<{ success: boolean; jobs?: any[]; error?: string }>;
    cancelJob: (jobId: string) => Promise<{ success: boolean; error?: string }>;
    onProgress: (callback: (data: any) => void) => void;
    removeProgressListener: (callback: (data: any) => void) => void;
  };

  // Watch Folder APIs
  watchFolder: {
    add: (rule: any) => Promise<{ success: boolean; error?: string }>;
    remove: (ruleId: string) => Promise<{ success: boolean; error?: string }>;
    update: (ruleId: string, rule: any) => Promise<{ success: boolean; error?: string }>;
    getAll: () => Promise<{ success: boolean; rules?: any[]; error?: string }>;
    pause: (ruleId: string) => Promise<{ success: boolean; error?: string }>;
    resume: (ruleId: string) => Promise<{ success: boolean; error?: string }>;
    onEvent: (callback: (event: string, data: any) => void) => void;
    removeEventListener: (callback: (event: string, data: any) => void) => void;
  };

  // File Import APIs
  fileImport: {
    openDialog: () => Promise<any>;
    openFolder: () => Promise<any>;
    getSupportedFormats: () => Promise<string[]>;
    validatePaths: (filePaths: string[]) => Promise<any>;
    processDropped: (filePaths: string[]) => Promise<any>;
  };

  // URL Ingest APIs
  urlIngest: {
    validate: (url: string) => Promise<any>;
    process: (url: string, options?: any) => Promise<any>;
    getJob: (jobId: string) => Promise<any>;
    getAllJobs: () => Promise<any>;
    cancelJob: (jobId: string) => Promise<any>;
    clearCompleted: () => Promise<any>;
    getDownloadDir: () => Promise<any>;
    setDownloadDir: (dir: string) => Promise<any>;
    checkTranscription: () => Promise<any>;
    onProgress: (callback: (progress: any) => void) => void;
    onComplete: (callback: (result: any) => void) => void;
    onError: (callback: (error: any) => void) => void;
    onCancelled: (callback: (data: any) => void) => void;
    removeProgressListener: (callback: (progress: any) => void) => void;
    removeCompleteListener: (callback: (result: any) => void) => void;
    removeErrorListener: (callback: (error: any) => void) => void;
    removeCancelledListener: (callback: (data: any) => void) => void;
  };

  // File System APIs
  fs: {
    showOpenDialog: (options?: any) => Promise<{ success: boolean; canceled?: boolean; filePaths?: string[]; error?: string }>;
    showSaveDialog: (options?: any) => Promise<{ success: boolean; canceled?: boolean; filePath?: string; error?: string }>;
    showFolderDialog: () => Promise<{ success: boolean; canceled?: boolean; filePaths?: string[]; error?: string }>;
    revealInExplorer: (filePath: string) => Promise<{ success: boolean; error?: string }>;
    onFilesSelected: (callback: (filePaths: string[]) => void) => void;
    removeFilesSelectedListener: (callback: (filePaths: string[]) => void) => void;
  };

  // Settings APIs
  settings: {
    get: (key: string, defaultValue?: any) => Promise<{ success: boolean; value?: any; error?: string }>;
    set: (key: string, value: any) => Promise<{ success: boolean; error?: string }>;
    getAll: () => Promise<{ success: boolean; settings?: any; error?: string }>;
    reset: () => Promise<{ success: boolean; error?: string }>;
  };

  // Secure Storage APIs
  secureStore: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string) => Promise<void>;
    delete: (key: string) => Promise<void>;
    has: (key: string) => Promise<boolean>;
    clear: () => Promise<void>;
  };

  // Window APIs
  window: {
    createTranscript: (transcriptId: string) => Promise<{ success: boolean; error?: string }>;
    createSettings: () => Promise<{ success: boolean; error?: string }>;
    close: (windowId: string) => Promise<{ success: boolean; error?: string }>;
    minimize: () => Promise<{ success: boolean; error?: string }>;
    toggleMaximize: () => Promise<{ success: boolean; error?: string }>;
    onMenuAction: (callback: (action: string) => void) => void;
    removeMenuActionListener: (callback: (action: string) => void) => void;
  };

  // Platform info
  platform: {
    os: string;
    arch: string;
    version: string;
  };
}

// Validate all IPC channels to prevent security issues
const ALLOWED_CHANNELS = {
  invoke: [
    // App channels
    'app:get-version',
    'app:get-info',
    'app:show-about',
    'app:open-external',
    
    // File import channels
    'file-import:open-dialog',
    'file-import:open-folder',
    'file-import:get-formats',
    'file-import:validate-paths',
    'file-import:process-dropped',
    
    // URL ingest channels
    'url-ingest:validate',
    'url-ingest:process',
    'url-ingest:get-job',
    'url-ingest:get-all-jobs',
    'url-ingest:cancel-job',
    'url-ingest:clear-completed',
    'url-ingest:get-download-dir',
    'url-ingest:set-download-dir',
    'url-ingest:check-transcription',
    
    // Whisper channels
    'whisper:initialize-model',
    'whisper:transcribe-file',
    'whisper:get-processing-jobs',
    'whisper:cancel-job',
    
    // Watch folder channels
    'watch-folder:add',
    'watch-folder:remove',
    'watch-folder:update',
    'watch-folder:get-all',
    'watch-folder:pause',
    'watch-folder:resume',
    
    // File system channels
    'fs:show-open-dialog',
    'fs:show-save-dialog',
    'fs:show-folder-dialog',
    'fs:reveal-in-explorer',
    
    // Settings channels
    'settings:get',
    'settings:set',
    'settings:get-all',
    'settings:reset',
    
    // Secure storage channels
    'secure-store:get',
    'secure-store:set',
    'secure-store:delete',
    'secure-store:has',
    'secure-store:clear',
    
    // Window channels
    'window:create-transcript',
    'window:create-settings',
    'window:close',
    'window:minimize',
    'window:toggle-maximize'
  ],
  on: [
    'whisper:progress',
    'watch-folder:event',
    'files:selected',
    'watch-folder:selected',
    'menu:preferences',
    'context-menu:transcribe-audio',
    'url-ingest:progress',
    'url-ingest:complete',
    'url-ingest:error',
    'url-ingest:cancelled'
  ]
};

// Helper function to validate channels
function isValidChannel(channel: string, type: 'invoke' | 'on'): boolean {
  return ALLOWED_CHANNELS[type].includes(channel);
}

// Create the safe API
const electronAPI: ElectronAPI = {
  // App APIs
  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    getInfo: () => ipcRenderer.invoke('app:get-info'),
    showAbout: () => ipcRenderer.invoke('app:show-about'),
    openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url)
  },

  // Whisper APIs
  whisper: {
    initializeModel: (config: any) => ipcRenderer.invoke('whisper:initialize-model', config),
    transcribeFile: (filePath: string, config: any) => ipcRenderer.invoke('whisper:transcribe-file', filePath, config),
    getProcessingJobs: () => ipcRenderer.invoke('whisper:get-processing-jobs'),
    cancelJob: (jobId: string) => ipcRenderer.invoke('whisper:cancel-job', jobId),
    onProgress: (callback: (data: any) => void) => {
      const listener = (event: IpcRendererEvent, data: any) => callback(data);
      ipcRenderer.on('whisper:progress', listener);
    },
    removeProgressListener: (callback: (data: any) => void) => {
      ipcRenderer.removeListener('whisper:progress', callback);
    }
  },

  // Watch Folder APIs
  watchFolder: {
    add: (rule: any) => ipcRenderer.invoke('watch-folder:add', rule),
    remove: (ruleId: string) => ipcRenderer.invoke('watch-folder:remove', ruleId),
    update: (ruleId: string, rule: any) => ipcRenderer.invoke('watch-folder:update', ruleId, rule),
    getAll: () => ipcRenderer.invoke('watch-folder:get-all'),
    pause: (ruleId: string) => ipcRenderer.invoke('watch-folder:pause', ruleId),
    resume: (ruleId: string) => ipcRenderer.invoke('watch-folder:resume', ruleId),
    onEvent: (callback: (event: string, data: any) => void) => {
      const listener = (ipcEvent: IpcRendererEvent, event: string, data: any) => callback(event, data);
      ipcRenderer.on('watch-folder:event', listener);
    },
    removeEventListener: (callback: (event: string, data: any) => void) => {
      // Need to wrap callback for correct signature
      ipcRenderer.removeAllListeners('watch-folder:event');
    }
  },

  // File Import APIs
  fileImport: {
    openDialog: () => ipcRenderer.invoke('file-import:open-dialog'),
    openFolder: () => ipcRenderer.invoke('file-import:open-folder'),
    getSupportedFormats: () => ipcRenderer.invoke('file-import:get-formats'),
    validatePaths: (filePaths: string[]) => ipcRenderer.invoke('file-import:validate-paths', filePaths),
    processDropped: (filePaths: string[]) => ipcRenderer.invoke('file-import:process-dropped', filePaths)
  },

  // URL Ingest APIs
  urlIngest: {
    validate: (url: string) => ipcRenderer.invoke('url-ingest:validate', url),
    process: (url: string, options?: any) => ipcRenderer.invoke('url-ingest:process', url, options),
    getJob: (jobId: string) => ipcRenderer.invoke('url-ingest:get-job', jobId),
    getAllJobs: () => ipcRenderer.invoke('url-ingest:get-all-jobs'),
    cancelJob: (jobId: string) => ipcRenderer.invoke('url-ingest:cancel-job', jobId),
    clearCompleted: () => ipcRenderer.invoke('url-ingest:clear-completed'),
    getDownloadDir: () => ipcRenderer.invoke('url-ingest:get-download-dir'),
    setDownloadDir: (dir: string) => ipcRenderer.invoke('url-ingest:set-download-dir', dir),
    checkTranscription: () => ipcRenderer.invoke('url-ingest:check-transcription'),
    onProgress: (callback: (progress: any) => void) => {
      const listener = (event: IpcRendererEvent, progress: any) => callback(progress);
      ipcRenderer.on('url-ingest:progress', listener);
    },
    onComplete: (callback: (result: any) => void) => {
      const listener = (event: IpcRendererEvent, result: any) => callback(result);
      ipcRenderer.on('url-ingest:complete', listener);
    },
    onError: (callback: (error: any) => void) => {
      const listener = (event: IpcRendererEvent, error: any) => callback(error);
      ipcRenderer.on('url-ingest:error', listener);
    },
    onCancelled: (callback: (data: any) => void) => {
      const listener = (event: IpcRendererEvent, data: any) => callback(data);
      ipcRenderer.on('url-ingest:cancelled', listener);
    },
    removeProgressListener: (callback: (progress: any) => void) => {
      ipcRenderer.removeAllListeners('url-ingest:progress');
    },
    removeCompleteListener: (callback: (result: any) => void) => {
      ipcRenderer.removeAllListeners('url-ingest:complete');
    },
    removeErrorListener: (callback: (error: any) => void) => {
      ipcRenderer.removeAllListeners('url-ingest:error');
    },
    removeCancelledListener: (callback: (data: any) => void) => {
      ipcRenderer.removeAllListeners('url-ingest:cancelled');
    }
  },

  // File System APIs
  fs: {
    showOpenDialog: (options?: any) => ipcRenderer.invoke('fs:show-open-dialog', options),
    showSaveDialog: (options?: any) => ipcRenderer.invoke('fs:show-save-dialog', options),
    showFolderDialog: () => ipcRenderer.invoke('fs:show-folder-dialog'),
    revealInExplorer: (filePath: string) => ipcRenderer.invoke('fs:reveal-in-explorer', filePath),
    onFilesSelected: (callback: (filePaths: string[]) => void) => {
      const listener = (event: IpcRendererEvent, filePaths: string[]) => callback(filePaths);
      ipcRenderer.on('files:selected', listener);
    },
    removeFilesSelectedListener: (callback: (filePaths: string[]) => void) => {
      // Need to wrap callback for correct signature
      ipcRenderer.removeAllListeners('files:selected');
    }
  },

  // Settings APIs
  settings: {
    get: (key: string, defaultValue?: any) => ipcRenderer.invoke('settings:get', key, defaultValue),
    set: (key: string, value: any) => ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:get-all'),
    reset: () => ipcRenderer.invoke('settings:reset')
  },

  // Secure Storage APIs
  secureStore: {
    get: (key: string) => ipcRenderer.invoke('secure-store:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('secure-store:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('secure-store:delete', key),
    has: (key: string) => ipcRenderer.invoke('secure-store:has', key),
    clear: () => ipcRenderer.invoke('secure-store:clear')
  },

  // Window APIs
  window: {
    createTranscript: (transcriptId: string) => ipcRenderer.invoke('window:create-transcript', transcriptId),
    createSettings: () => ipcRenderer.invoke('window:create-settings'),
    close: (windowId: string) => ipcRenderer.invoke('window:close', windowId),
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
    onMenuAction: (callback: (action: string) => void) => {
      const listener = (event: IpcRendererEvent, action: string) => callback(action);
      ipcRenderer.on('menu:preferences', listener);
    },
    removeMenuActionListener: (callback: (action: string) => void) => {
      // Need to wrap callback for correct signature
      ipcRenderer.removeAllListeners('menu:preferences');
    }
  },

  // Platform info
  platform: {
    os: process.platform,
    arch: process.arch,
    version: process.version
  }
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Also expose a simplified version for backward compatibility
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (channel: string, ...args: any[]) => {
      if (isValidChannel(channel, 'invoke')) {
        return ipcRenderer.invoke(channel, ...args);
      } else {
        throw new Error(`Invalid IPC channel: ${channel}`);
      }
    },
    on: (channel: string, func: (event: IpcRendererEvent, ...args: any[]) => void) => {
      if (isValidChannel(channel, 'on')) {
        ipcRenderer.on(channel, func);
      } else {
        throw new Error(`Invalid IPC channel: ${channel}`);
      }
    },
    removeListener: (channel: string, func: (...args: any[]) => void) => {
      if (isValidChannel(channel, 'on')) {
        ipcRenderer.removeListener(channel, func);
      }
    }
  }
});

// Log when preload script is loaded
console.log('VoiceFlowPro preload script loaded');

// Make the API types available globally
declare global {
  interface Window {
    electronAPI: ElectronAPI;
    electron: {
      ipcRenderer: {
        invoke: (channel: string, ...args: any[]) => Promise<any>;
        on: (channel: string, func: (event: IpcRendererEvent, ...args: any[]) => void) => void;
        removeListener: (channel: string, func: (...args: any[]) => void) => void;
      };
    };
  }
}