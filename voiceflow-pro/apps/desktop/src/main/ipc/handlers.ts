import { ipcMain, IpcMainInvokeEvent, dialog, shell } from 'electron';
import * as log from 'electron-log';
import Store from 'electron-store';

import { DesktopWhisperService } from '../services/desktopWhisperService';
import { FileImportService } from '../services/fileImportService';
import { SecureStorageService } from '../services/secureStorageService';
import { WatchFolderService } from '../services/watchFolderService';
import { WindowManager } from '../services/windowManager';
import { WatchRule } from '../types/whisper';

interface Services {
  whisper: DesktopWhisperService;
  fileImport: FileImportService;
  watchFolder: WatchFolderService;
  store: Store<any>;
  windowManager: WindowManager;
  secureStorage: SecureStorageService;
}

export function setupIPC(services: Services) {
  log.info('Setting up IPC handlers...');

  // App-related handlers
  setupAppHandlers(services);
  
  // Whisper-related handlers
  setupWhisperHandlers(services);
  
  // Watch folder handlers
  setupWatchFolderHandlers(services);
  
  // File system handlers
  setupFileSystemHandlers(services);
  
  // Settings handlers
  setupSettingsHandlers(services);
  
  // Secure storage handlers
  setupSecureStorageHandlers(services);
  
  // Window management handlers
  setupWindowHandlers(services);

  log.info('IPC handlers set up successfully');
}

function setupAppHandlers(_services: Services) {
  // Get app version
  ipcMain.handle('app:get-version', () => {
    return require('../../../../package.json').version;
  });

  // Get app info
  ipcMain.handle('app:get-info', () => {
    return {
      version: require('../../../../package.json').version,
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version
    };
  });

  // Show about dialog
  ipcMain.handle('app:show-about', async () => {
    const { version } = require('../../../../package.json');
    
    return dialog.showMessageBox({
      type: 'info',
      title: 'About VoiceFlow Pro',
      message: 'VoiceFlow Pro',
      detail: `Version: ${version}\nPlatform: ${process.platform}\nElectron: ${process.versions.electron}\nNode.js: ${process.versions.node}`,
      buttons: ['OK']
    });
  });

  // Open external URL
  ipcMain.handle('app:open-external', async (event: IpcMainInvokeEvent, url: string) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      log.error('Failed to open external URL:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}

function setupWhisperHandlers(services: Services) {
  const { whisper } = services;

  // Initialize Whisper model
  ipcMain.handle('whisper:initialize-model', async (event: IpcMainInvokeEvent, config: any) => {
    try {
      log.info('IPC: Initializing Whisper model', config);
      const result = await whisper.initializeModel(config);
      return result;
    } catch (error) {
      log.error('IPC: Failed to initialize Whisper model:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Transcribe file
  ipcMain.handle('whisper:transcribe-file', async (event: IpcMainInvokeEvent, filePath: string, config: any) => {
    try {
      log.info('IPC: Transcribing file', { filePath, config });
      const result = await whisper.transcribeFile(filePath, config);
      return result;
    } catch (error) {
      log.error('IPC: Failed to transcribe file:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Get processing jobs
  ipcMain.handle('whisper:get-processing-jobs', async () => {
    try {
      const result = await whisper.getProcessingJobs();
      return result;
    } catch (error) {
      log.error('IPC: Failed to get processing jobs:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Cancel job
  ipcMain.handle('whisper:cancel-job', async (event: IpcMainInvokeEvent, jobId: string) => {
    try {
      const result = await whisper.cancelJob(jobId);
      return result;
    } catch (error) {
      log.error('IPC: Failed to cancel job:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}

function setupWatchFolderHandlers(services: Services) {
  const { watchFolder } = services;

  // Add watch folder
  ipcMain.handle('watch-folder:add', async (event: IpcMainInvokeEvent, rule: WatchRule) => {
    try {
      log.info('IPC: Adding watch folder', rule);
      await watchFolder.addWatchFolder(rule);
      return { success: true };
    } catch (error) {
      log.error('IPC: Failed to add watch folder:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Remove watch folder
  ipcMain.handle('watch-folder:remove', async (event: IpcMainInvokeEvent, ruleId: string) => {
    try {
      log.info('IPC: Removing watch folder', ruleId);
      await watchFolder.removeWatchFolder(ruleId);
      return { success: true };
    } catch (error) {
      log.error('IPC: Failed to remove watch folder:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Update watch folder
  ipcMain.handle('watch-folder:update', async (event: IpcMainInvokeEvent, ruleId: string, rule: WatchRule) => {
    try {
      log.info('IPC: Updating watch folder', { ruleId, rule });
      await watchFolder.updateWatchFolder(ruleId, rule);
      return { success: true };
    } catch (error) {
      log.error('IPC: Failed to update watch folder:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Get all watch folders
  ipcMain.handle('watch-folder:get-all', async () => {
    try {
      const rules = watchFolder.getWatchFolders();
      return { success: true, rules };
    } catch (error) {
      log.error('IPC: Failed to get watch folders:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Pause watch folder
  ipcMain.handle('watch-folder:pause', async (event: IpcMainInvokeEvent, ruleId: string) => {
    try {
      await watchFolder.pauseWatchFolder(ruleId);
      return { success: true };
    } catch (error) {
      log.error('IPC: Failed to pause watch folder:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Resume watch folder
  ipcMain.handle('watch-folder:resume', async (event: IpcMainInvokeEvent, ruleId: string) => {
    try {
      await watchFolder.resumeWatchFolder(ruleId);
      return { success: true };
    } catch (error) {
      log.error('IPC: Failed to resume watch folder:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}

function setupFileSystemHandlers(services: Services) {
  const { fileImport } = services;
  
  // Import files using FileImportService
  ipcMain.handle('file-import:open-dialog', async () => {
    try {
      const result = await fileImport.showOpenDialog();
      return result;
    } catch (error) {
      log.error('IPC: Failed to import files:', error);
      return { success: false, files: [], totalSize: 0, errors: [error instanceof Error ? error.message : String(error)] };
    }
  });
  
  // Import folder
  ipcMain.handle('file-import:open-folder', async () => {
    try {
      const result = await fileImport.showFolderDialog();
      return result;
    } catch (error) {
      log.error('IPC: Failed to import folder:', error);
      return { success: false, files: [], totalSize: 0, errors: [error instanceof Error ? error.message : String(error)] };
    }
  });
  
  // Get supported formats
  ipcMain.handle('file-import:get-formats', () => {
    return fileImport.getSupportedFormats();
  });
  
  // Validate dropped files
  ipcMain.handle('file-import:validate-paths', async (event: IpcMainInvokeEvent, filePaths: string[]) => {
    const validPaths = filePaths.filter(p => fileImport.isFormatSupported(p));
    return {
      valid: validPaths,
      invalid: filePaths.filter(p => !validPaths.includes(p))
    };
  });
  
  // Process dropped files
  ipcMain.handle('file-import:process-dropped', async (event: IpcMainInvokeEvent, filePaths: string[]) => {
    return fileImport.importFiles(filePaths);
  });
  
  // Show open dialog (legacy)
  ipcMain.handle('fs:show-open-dialog', async (event: IpcMainInvokeEvent, options?: any) => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'Audio Files', extensions: ['mp3', 'wav', 'm4a', 'ogg', 'flac'] },
          { name: 'Video Files', extensions: ['mp4', 'mov', 'avi'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        ...options
      });
      
      return { success: true, ...result };
    } catch (error) {
      log.error('IPC: Failed to show open dialog:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Show save dialog
  ipcMain.handle('fs:show-save-dialog', async (event: IpcMainInvokeEvent, options?: any) => {
    try {
      const result = await dialog.showSaveDialog({
        filters: [
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'Subtitle Files', extensions: ['srt', 'vtt'] },
          { name: 'JSON Files', extensions: ['json'] }
        ],
        ...options
      });
      
      return { success: true, ...result };
    } catch (error) {
      log.error('IPC: Failed to show save dialog:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Show folder dialog
  ipcMain.handle('fs:show-folder-dialog', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
      });
      
      return { success: true, ...result };
    } catch (error) {
      log.error('IPC: Failed to show folder dialog:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Reveal in file explorer
  ipcMain.handle('fs:reveal-in-explorer', async (event: IpcMainInvokeEvent, filePath: string) => {
    try {
      shell.showItemInFolder(filePath);
      return { success: true };
    } catch (error) {
      log.error('IPC: Failed to reveal in explorer:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}

function setupSettingsHandlers(services: Services) {
  const { store } = services;

  // Get setting
  ipcMain.handle('settings:get', (event: IpcMainInvokeEvent, key: string, defaultValue?: any) => {
    try {
      const value = store.get(key, defaultValue);
      return { success: true, value };
    } catch (error) {
      log.error('IPC: Failed to get setting:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Set setting
  ipcMain.handle('settings:set', (event: IpcMainInvokeEvent, key: string, value: any) => {
    try {
      store.set(key, value);
      return { success: true };
    } catch (error) {
      log.error('IPC: Failed to set setting:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Get all settings
  ipcMain.handle('settings:get-all', () => {
    try {
      const settings = store.store;
      return { success: true, settings };
    } catch (error) {
      log.error('IPC: Failed to get all settings:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Reset settings
  ipcMain.handle('settings:reset', () => {
    try {
      store.clear();
      return { success: true };
    } catch (error) {
      log.error('IPC: Failed to reset settings:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}

function setupWindowHandlers(services: Services) {
  const { windowManager } = services;

  // Create transcript window
  ipcMain.handle('window:create-transcript', async (event: IpcMainInvokeEvent, transcriptId: string) => {
    try {
      await windowManager.createTranscriptWindow(transcriptId);
      return { success: true };
    } catch (error) {
      log.error('IPC: Failed to create transcript window:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Create settings window
  ipcMain.handle('window:create-settings', async () => {
    try {
      await windowManager.createSettingsWindow();
      return { success: true };
    } catch (error) {
      log.error('IPC: Failed to create settings window:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Close window
  ipcMain.handle('window:close', async (event: IpcMainInvokeEvent, windowId: string) => {
    try {
      windowManager.closeWindow(windowId);
      return { success: true };
    } catch (error) {
      log.error('IPC: Failed to close window:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Minimize window
  ipcMain.handle('window:minimize', async (_event: IpcMainInvokeEvent) => {
    try {
      const window = windowManager.getWindow('main');
      if (window) {
        window.minimize();
      }
      return { success: true };
    } catch (error) {
      log.error('IPC: Failed to minimize window:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Maximize/restore window
  ipcMain.handle('window:toggle-maximize', async (_event: IpcMainInvokeEvent) => {
    try {
      const window = windowManager.getWindow('main');
      if (window) {
        if (window.isMaximized()) {
          window.restore();
        } else {
          window.maximize();
        }
      }
      return { success: true };
    } catch (error) {
      log.error('IPC: Failed to toggle maximize:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}

function setupSecureStorageHandlers(services: Services) {
  const { secureStorage } = services;

  // Get secure value
  ipcMain.handle('secure-store:get', async (event: IpcMainInvokeEvent, key: string) => {
    try {
      const value = await secureStorage.get(key);
      return value;
    } catch (error) {
      log.error(`IPC: Failed to get secure value for key ${key}:`, error);
      return null;
    }
  });

  // Set secure value
  ipcMain.handle('secure-store:set', async (event: IpcMainInvokeEvent, key: string, value: string) => {
    try {
      await secureStorage.set(key, value);
      return;
    } catch (error) {
      log.error(`IPC: Failed to set secure value for key ${key}:`, error);
      throw error;
    }
  });

  // Delete secure value
  ipcMain.handle('secure-store:delete', async (event: IpcMainInvokeEvent, key: string) => {
    try {
      await secureStorage.delete(key);
      return;
    } catch (error) {
      log.error(`IPC: Failed to delete secure value for key ${key}:`, error);
      throw error;
    }
  });

  // Check if secure value exists
  ipcMain.handle('secure-store:has', async (event: IpcMainInvokeEvent, key: string) => {
    try {
      const exists = await secureStorage.has(key);
      return exists;
    } catch (error) {
      log.error(`IPC: Failed to check secure value for key ${key}:`, error);
      return false;
    }
  });

  // Clear all secure values
  ipcMain.handle('secure-store:clear', async (_event: IpcMainInvokeEvent) => {
    try {
      await secureStorage.clear();
      return;
    } catch (error) {
      log.error('IPC: Failed to clear secure storage:', error);
      throw error;
    }
  });
}