/**
 * Download Manager Service
 * Handles downloading media from various sources using yt-dlp and direct download
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as log from 'electron-log';
import { app } from 'electron';
import { DownloaderHelper } from 'node-downloader-helper';
import type { Provider } from './urlValidatorService';

export interface DownloadOptions {
  outputPath?: string;
  quality?: 'best' | 'good' | 'worst';
  format?: 'mp3' | 'wav' | 'm4a';
  cookiesPath?: string;
  extractAudio?: boolean;
  concurrent?: boolean;
}

export interface DownloadResult {
  success: boolean;
  filePath?: string;
  error?: string;
  metadata?: {
    title?: string;
    duration?: number;
    author?: string;
    description?: string;
    thumbnail?: string;
  };
}

export interface DownloadProgress {
  percent: number;
  downloaded: number;
  total: number;
  speed: number;
  eta: number;
}

export class DownloadManager extends EventEmitter {
  private ytDlpPath: string | null = null;
  private activeDownloads = new Map<string, ChildProcess | DownloaderHelper>();
  private downloadDir: string;

  constructor() {
    super();
    this.downloadDir = path.join(app.getPath('downloads'), 'VoiceFlowPro');
    fs.ensureDirSync(this.downloadDir);
    this.initializeYtDlp();
  }

  /**
   * Initialize yt-dlp binary
   */
  private async initializeYtDlp(): Promise<void> {
    try {
      const ytDlpDir = path.join(app.getPath('userData'), 'binaries');
      await fs.ensureDir(ytDlpDir);
      
      const platform = process.platform;
      const ytDlpName = platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
      this.ytDlpPath = path.join(ytDlpDir, ytDlpName);

      // Check if yt-dlp exists
      if (!await fs.pathExists(this.ytDlpPath)) {
        log.info('DownloadManager: yt-dlp not found, downloading...');
        await this.downloadYtDlp();
      } else {
        // Check if update is needed (optional)
        log.info('DownloadManager: yt-dlp found at', this.ytDlpPath);
      }
    } catch (error) {
      log.error('DownloadManager: Failed to initialize yt-dlp:', error);
      // Fall back to system yt-dlp if available
      this.ytDlpPath = 'yt-dlp';
    }
  }

  /**
   * Download yt-dlp binary
   */
  private async downloadYtDlp(): Promise<void> {
    const platform = process.platform;
    const arch = process.arch;
    
    let downloadUrl: string;
    
    if (platform === 'win32') {
      downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
    } else if (platform === 'darwin') {
      downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos';
    } else {
      downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
    }

    const downloader = new DownloaderHelper(downloadUrl, path.dirname(this.ytDlpPath!), {
      fileName: path.basename(this.ytDlpPath!)
    });

    return new Promise((resolve, reject) => {
      downloader.on('end', async () => {
        // Make executable on Unix systems
        if (platform !== 'win32') {
          await fs.chmod(this.ytDlpPath!, 0o755);
        }
        log.info('DownloadManager: yt-dlp downloaded successfully');
        resolve();
      });

      downloader.on('error', (error) => {
        log.error('DownloadManager: Failed to download yt-dlp:', error);
        reject(error);
      });

      downloader.start().catch(reject);
    });
  }

  /**
   * Main download method that routes to appropriate handler
   */
  async download(url: string, provider: Provider, options: DownloadOptions = {}): Promise<DownloadResult> {
    const jobId = this.generateJobId(url);
    
    try {
      // Set default options
      const opts: DownloadOptions = {
        outputPath: this.downloadDir,
        quality: 'best',
        format: 'mp3',
        extractAudio: true,
        ...options
      };

      log.info(`DownloadManager: Starting download for ${provider} - ${url}`);

      switch (provider) {
        case 'youtube':
        case 'vimeo':
        case 'soundcloud':
        case 'twitter':
          return await this.downloadWithYtDlp(url, jobId, opts);
        
        case 'direct':
        case 'podcast':
          return await this.downloadDirect(url, jobId, opts);
        
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error) {
      log.error('DownloadManager: Download failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Download failed'
      };
    } finally {
      this.activeDownloads.delete(jobId);
    }
  }

  /**
   * Download using yt-dlp
   */
  private async downloadWithYtDlp(url: string, jobId: string, options: DownloadOptions): Promise<DownloadResult> {
    if (!this.ytDlpPath) {
      throw new Error('yt-dlp is not available');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = path.join(options.outputPath!, `download_${timestamp}.%(ext)s`);
    
    const args: string[] = [
      url,
      '-o', outputFile,
      '--no-playlist',
      '--no-warnings',
      '--progress',
      '--newline'
    ];

    // Add audio extraction options
    if (options.extractAudio) {
      args.push(
        '-x',
        '--audio-format', options.format!,
        '--audio-quality', '0'
      );
    }

    // Add quality settings
    if (options.quality === 'worst') {
      args.push('-f', 'worst');
    } else if (options.quality === 'good') {
      args.push('-f', 'good');
    } else {
      args.push('-f', 'best');
    }

    // Add cookies if provided
    if (options.cookiesPath && await fs.pathExists(options.cookiesPath)) {
      args.push('--cookies', options.cookiesPath);
    } else {
      // Try to use browser cookies
      args.push('--cookies-from-browser', 'chrome');
    }

    // Get metadata
    args.push('--print-json');

    return new Promise((resolve, reject) => {
      let metadata: any = {};
      let finalPath: string | undefined;
      let lastProgress = 0;

      const process = spawn(this.ytDlpPath!, args);
      this.activeDownloads.set(jobId, process);

      process.stdout.on('data', (data: Buffer) => {
        const output = data.toString();
        
        // Try to parse as JSON (metadata)
        try {
          const json = JSON.parse(output);
          if (json.title) {
            metadata = {
              title: json.title,
              duration: json.duration,
              author: json.uploader || json.channel,
              description: json.description,
              thumbnail: json.thumbnail
            };
            
            // Determine final file path
            const ext = options.extractAudio ? options.format : (json.ext || 'mp4');
            finalPath = outputFile.replace('%(ext)s', ext);
          }
        } catch {
          // Parse progress
          const progressMatch = output.match(/\[download\]\s+(\d+\.?\d*)%/);
          if (progressMatch) {
            const percent = parseFloat(progressMatch[1]);
            if (percent !== lastProgress) {
              lastProgress = percent;
              this.emitProgress(jobId, percent);
            }
          }

          // Check for completion
          if (output.includes('[download] 100%')) {
            this.emitProgress(jobId, 100);
          }
        }
      });

      process.stderr.on('data', (data: Buffer) => {
        const error = data.toString();
        log.warn('yt-dlp stderr:', error);
      });

      process.on('exit', async (code) => {
        if (code === 0) {
          // Find the actual downloaded file
          if (!finalPath) {
            const files = await fs.readdir(options.outputPath!);
            const downloadedFile = files.find(f => f.includes(timestamp));
            if (downloadedFile) {
              finalPath = path.join(options.outputPath!, downloadedFile);
            }
          }

          if (finalPath && await fs.pathExists(finalPath)) {
            resolve({
              success: true,
              filePath: finalPath,
              metadata
            });
          } else {
            reject(new Error('Downloaded file not found'));
          }
        } else {
          reject(new Error(`yt-dlp exited with code ${code}`));
        }
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Direct download for media files
   */
  private async downloadDirect(url: string, jobId: string, options: DownloadOptions): Promise<DownloadResult> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const urlPath = new URL(url).pathname;
    const originalName = path.basename(urlPath);
    const fileName = `${timestamp}_${originalName}`;
    
    const downloader = new DownloaderHelper(url, options.outputPath!, {
      fileName,
      retry: { maxRetries: 3, delay: 3000 },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    this.activeDownloads.set(jobId, downloader);

    return new Promise((resolve, reject) => {
      let lastProgress = 0;

      downloader.on('download', (downloadInfo) => {
        log.info('DownloadManager: Starting direct download', downloadInfo);
      });

      downloader.on('progress', (stats) => {
        const progress = stats.progress;
        if (progress !== lastProgress) {
          lastProgress = progress;
          this.emit('progress', {
            jobId,
            percent: progress,
            downloaded: stats.downloaded,
            total: stats.total,
            speed: stats.speed || 0,
            eta: 0 // Calculate from progress and speed if needed
          });
        }
      });

      downloader.on('end', (downloadInfo) => {
        const filePath = path.join(options.outputPath!, fileName);
        resolve({
          success: true,
          filePath,
          metadata: {
            title: originalName.replace(/\.\w+$/, '')
          }
        });
      });

      downloader.on('error', (error) => {
        log.error('DownloadManager: Direct download failed:', error);
        reject(error);
      });

      downloader.start().catch(reject);
    });
  }

  /**
   * Cancel a download
   */
  cancelDownload(jobId: string): void {
    const download = this.activeDownloads.get(jobId);
    
    if (download) {
      if (download instanceof DownloaderHelper) {
        download.stop();
      } else {
        // It's a ChildProcess (yt-dlp)
        download.kill('SIGTERM');
      }
      
      this.activeDownloads.delete(jobId);
      log.info(`DownloadManager: Cancelled download ${jobId}`);
    }
  }

  /**
   * Cancel all active downloads
   */
  cancelAllDownloads(): void {
    for (const [jobId] of this.activeDownloads) {
      this.cancelDownload(jobId);
    }
  }

  /**
   * Emit progress event
   */
  private emitProgress(jobId: string, percent: number): void {
    this.emit('progress', {
      jobId,
      percent,
      downloaded: 0, // These will be estimated for yt-dlp
      total: 0,
      speed: 0,
      eta: 0
    });
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(url: string): string {
    return `dl_${Date.now()}_${Buffer.from(url).toString('base64').substr(0, 8)}`;
  }

  /**
   * Get download directory
   */
  getDownloadDirectory(): string {
    return this.downloadDir;
  }

  /**
   * Set custom download directory
   */
  setDownloadDirectory(dir: string): void {
    this.downloadDir = dir;
    fs.ensureDirSync(this.downloadDir);
  }

  /**
   * Check if yt-dlp is available
   */
  isYtDlpAvailable(): boolean {
    return this.ytDlpPath !== null;
  }

  /**
   * Update yt-dlp to latest version
   */
  async updateYtDlp(): Promise<void> {
    log.info('DownloadManager: Updating yt-dlp...');
    if (this.ytDlpPath && this.ytDlpPath !== 'yt-dlp') {
      await fs.remove(this.ytDlpPath);
      await this.downloadYtDlp();
    }
  }
}