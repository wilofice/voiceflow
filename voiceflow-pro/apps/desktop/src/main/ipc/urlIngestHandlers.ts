/**
 * IPC Handlers for URL Ingest
 * Handles communication between renderer and main process for URL ingest operations
 */

import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';
import * as log from 'electron-log';

import { URLIngestService } from '../services/urlIngest/urlIngestService';
import type { IngestOptions, IngestResult } from '../services/urlIngest/urlIngestService';

export function setupURLIngestHandlers(urlIngestService: URLIngestService): void {
  log.info('Setting up URL ingest IPC handlers...');

  // Validate a URL
  ipcMain.handle('url-ingest:validate', async (event: IpcMainInvokeEvent, url: string) => {
    try {
      log.info('IPC: Validating URL', url);
      const result = await urlIngestService.validateURL(url);
      return { success: true, ...result };
    } catch (error) {
      log.error('IPC: URL validation failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Validation failed' 
      };
    }
  });

  // Process a URL (download and transcribe)
  ipcMain.handle('url-ingest:process', async (event: IpcMainInvokeEvent, url: string, options?: IngestOptions) => {
    try {
      log.info('IPC: Processing URL', { url, options });
      
      // Process the URL
      const result = await urlIngestService.processURL(url, options || {});
      
      return result;
    } catch (error) {
      log.error('IPC: URL processing failed:', error);
      return {
        success: false,
        jobId: '',
        url,
        provider: null,
        error: error instanceof Error ? error.message : 'Processing failed'
      } as IngestResult;
    }
  });

  // Get job status
  ipcMain.handle('url-ingest:get-job', async (event: IpcMainInvokeEvent, jobId: string) => {
    try {
      const job = urlIngestService.getJobStatus(jobId);
      return { success: true, job };
    } catch (error) {
      log.error('IPC: Failed to get job:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get job' 
      };
    }
  });

  // Get all jobs
  ipcMain.handle('url-ingest:get-all-jobs', async () => {
    try {
      const jobs = urlIngestService.getAllJobs();
      return { success: true, jobs };
    } catch (error) {
      log.error('IPC: Failed to get jobs:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get jobs' 
      };
    }
  });

  // Cancel a job
  ipcMain.handle('url-ingest:cancel-job', async (event: IpcMainInvokeEvent, jobId: string) => {
    try {
      urlIngestService.cancelJob(jobId);
      return { success: true };
    } catch (error) {
      log.error('IPC: Failed to cancel job:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to cancel job' 
      };
    }
  });

  // Clear completed jobs
  ipcMain.handle('url-ingest:clear-completed', async () => {
    try {
      urlIngestService.clearCompletedJobs();
      return { success: true };
    } catch (error) {
      log.error('IPC: Failed to clear jobs:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to clear jobs' 
      };
    }
  });

  // Get download directory
  ipcMain.handle('url-ingest:get-download-dir', async () => {
    try {
      const dir = urlIngestService.getDownloadDirectory();
      return { success: true, directory: dir };
    } catch (error) {
      log.error('IPC: Failed to get download directory:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get directory' 
      };
    }
  });

  // Set download directory
  ipcMain.handle('url-ingest:set-download-dir', async (event: IpcMainInvokeEvent, dir: string) => {
    try {
      urlIngestService.setDownloadDirectory(dir);
      return { success: true };
    } catch (error) {
      log.error('IPC: Failed to set download directory:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to set directory' 
      };
    }
  });

  // Check if transcription is available
  ipcMain.handle('url-ingest:check-transcription', async () => {
    try {
      const available = urlIngestService.isTranscriptionAvailable();
      return { success: true, available };
    } catch (error) {
      log.error('IPC: Failed to check transcription:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to check' 
      };
    }
  });

  // Set up event forwarding to renderer
  urlIngestService.on('progress', (progress) => {
    // Send to all windows
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('url-ingest:progress', progress);
    });
  });

  urlIngestService.on('complete', (result) => {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('url-ingest:complete', result);
    });
  });

  urlIngestService.on('error', (error) => {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('url-ingest:error', error);
    });
  });

  urlIngestService.on('cancelled', (data) => {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('url-ingest:cancelled', data);
    });
  });

  log.info('URL ingest IPC handlers set up successfully');
}

// Export types for preload script
export interface URLIngestAPI {
  validate: (url: string) => Promise<any>;
  process: (url: string, options?: IngestOptions) => Promise<IngestResult>;
  getJob: (jobId: string) => Promise<any>;
  getAllJobs: () => Promise<any>;
  cancelJob: (jobId: string) => Promise<any>;
  clearCompleted: () => Promise<any>;
  getDownloadDir: () => Promise<any>;
  setDownloadDir: (dir: string) => Promise<any>;
  checkTranscription: () => Promise<any>;
  
  // Event listeners
  onProgress: (callback: (progress: any) => void) => void;
  onComplete: (callback: (result: any) => void) => void;
  onError: (callback: (error: any) => void) => void;
  onCancelled: (callback: (data: any) => void) => void;
  
  // Remove listeners
  removeProgressListener: (callback: (progress: any) => void) => void;
  removeCompleteListener: (callback: (result: any) => void) => void;
  removeErrorListener: (callback: (error: any) => void) => void;
  removeCancelledListener: (callback: (data: any) => void) => void;
}