import { EventEmitter } from 'events';
import * as path from 'path';

import * as chokidar from 'chokidar';
import * as log from 'electron-log';
import * as fs from 'fs-extra';


import { WatchRule, WhisperConfig } from '../types/whisper';

import { WhisperService } from './whisperService';

export class WatchFolderService extends EventEmitter {
  private watchers: Map<string, chokidar.FSWatcher> = new Map();
  private rules: Map<string, WatchRule> = new Map();
  private whisperService: WhisperService;
  private supportedExtensions = new Set(['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.mp4', '.mov', '.avi']);

  constructor() {
    super();
    this.whisperService = new WhisperService();
  }

  async initialize(): Promise<void> {
    log.info('Initializing WatchFolderService...');
    await this.whisperService.initialize();
    log.info('WatchFolderService initialized');
  }

  async addWatchFolder(rule: WatchRule): Promise<void> {
    log.info(`Adding watch folder: ${rule.path}`);

    try {
      // Check if path exists
      if (!await fs.pathExists(rule.path)) {
        throw new Error(`Path does not exist: ${rule.path}`);
      }

      // Check if it's a directory
      const stats = await fs.stat(rule.path);
      if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${rule.path}`);
      }

      // Remove existing watcher if it exists
      if (this.watchers.has(rule.id)) {
        await this.removeWatchFolder(rule.id);
      }

      // Create new watcher
      const watcher = chokidar.watch(rule.path, {
        persistent: true,
        // recursive: rule.recursive, // Not needed for chokidar
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 2000,
          pollInterval: 100
        },
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/Thumbs.db',
          '**/.DS_Store'
        ]
      });

      // Set up event listeners
      watcher.on('add', async (filePath) => {
        await this.handleFileAdded(filePath, rule);
      });

      watcher.on('change', async (filePath) => {
        await this.handleFileChanged(filePath, rule);
      });

      watcher.on('error', (error) => {
        log.error(`Watcher error for ${rule.path}:`, error);
        this.emit('error', { ruleId: rule.id, error });
      });

      watcher.on('ready', () => {
        log.info(`Watcher ready for: ${rule.path}`);
        this.emit('ready', { ruleId: rule.id });
      });

      // Store watcher and rule
      this.watchers.set(rule.id, watcher);
      this.rules.set(rule.id, rule);

      log.info(`Watch folder added successfully: ${rule.path}`);
      this.emit('added', rule);

    } catch (error) {
      log.error(`Failed to add watch folder ${rule.path}:`, error);
      throw error;
    }
  }

  async removeWatchFolder(ruleId: string): Promise<void> {
    log.info(`Removing watch folder: ${ruleId}`);

    const watcher = this.watchers.get(ruleId);
    const rule = this.rules.get(ruleId);

    if (watcher) {
      await watcher.close();
      this.watchers.delete(ruleId);
    }

    if (rule) {
      this.rules.delete(ruleId);
      log.info(`Watch folder removed: ${rule.path}`);
      this.emit('removed', rule);
    }
  }

  async updateWatchFolder(ruleId: string, updatedRule: WatchRule): Promise<void> {
    log.info(`Updating watch folder: ${ruleId}`);

    // Remove existing watcher
    await this.removeWatchFolder(ruleId);

    // Add with updated rule
    await this.addWatchFolder(updatedRule);
  }

  async pauseWatchFolder(ruleId: string): Promise<void> {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = false;
      log.info(`Watch folder paused: ${rule.path}`);
      this.emit('paused', rule);
    }
  }

  async resumeWatchFolder(ruleId: string): Promise<void> {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = true;
      log.info(`Watch folder resumed: ${rule.path}`);
      this.emit('resumed', rule);
    }
  }

  getWatchFolders(): WatchRule[] {
    return Array.from(this.rules.values());
  }

  getWatchFolder(ruleId: string): WatchRule | undefined {
    return this.rules.get(ruleId);
  }

  private async handleFileAdded(filePath: string, rule: WatchRule): Promise<void> {
    log.info(`File added: ${filePath} (rule: ${rule.id})`);

    if (!rule.enabled) {
      log.info(`Rule ${rule.id} is disabled, skipping file: ${filePath}`);
      return;
    }

    if (!this.isSupportedFile(filePath)) {
      log.info(`File type not supported: ${filePath}`);
      return;
    }

    try {
      // Update rule's last triggered time
      rule.lastTriggered = new Date();

      // Emit event
      this.emit('fileDetected', { filePath, rule });

      // Process the file
      await this.processFile(filePath, rule);

    } catch (error) {
      log.error(`Failed to process file ${filePath}:`, error);
      this.emit('error', { ruleId: rule.id, filePath, error });
    }
  }

  private async handleFileChanged(filePath: string, rule: WatchRule): Promise<void> {
    // For now, treat file changes the same as file additions
    // In the future, we might want different behavior for modifications
    await this.handleFileAdded(filePath, rule);
  }

  private isSupportedFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.supportedExtensions.has(ext);
  }

  private async processFile(filePath: string, rule: WatchRule): Promise<void> {
    log.info(`Processing file: ${filePath} with rule: ${rule.id}`);

    try {
      // Create whisper config from rule
      const whisperConfig: WhisperConfig = {
        model: rule.model,
        language: rule.language === 'auto' ? undefined : rule.language,
        task: 'transcribe', // Default to transcribe
        wordTimestamps: true
      };

      // Initialize model if needed
      await this.whisperService.initializeModel(whisperConfig);

      // Start transcription
      const result = await this.whisperService.transcribeFile(filePath, whisperConfig);

      log.info(`Transcription completed for: ${filePath}`);

      // Execute post-processing actions
      if (rule.postProcess) {
        await this.executePostProcessing(filePath, result, rule);
      }

      this.emit('processed', { filePath, rule, result });

    } catch (error) {
      log.error(`Processing failed for ${filePath}:`, error);
      this.emit('processingError', { filePath, rule, error });
      throw error;
    }
  }

  private async executePostProcessing(filePath: string, result: any, rule: WatchRule): Promise<void> {
    const postProcess = rule.postProcess;
    if (!postProcess) return;

    log.info(`Executing post-processing for: ${filePath}`);

    try {
      // Move file to archive folder
      if (postProcess.moveToFolder) {
        const fileName = path.basename(filePath);
        const destinationPath = path.join(postProcess.moveToFolder, fileName);
        
        // Ensure destination directory exists
        await fs.ensureDir(postProcess.moveToFolder);
        
        // Move the file
        await fs.move(filePath, destinationPath, { overwrite: false });
        log.info(`File moved to: ${destinationPath}`);
      }

      // Send webhook notification
      if (postProcess.webhook) {
        await this.sendWebhook(postProcess.webhook, {
          filePath,
          rule,
          result,
          timestamp: new Date().toISOString()
        });
      }

      // Export in different formats
      if (postProcess.exportFormats && postProcess.exportFormats.length > 0) {
        await this.exportTranscription(filePath, result, postProcess.exportFormats);
      }

      // Send desktop notification
      if (postProcess.notify) {
        this.sendNotification(`Transcription completed: ${path.basename(filePath)}`);
      }

    } catch (error) {
      log.error(`Post-processing failed for ${filePath}:`, error);
      throw error;
    }
  }

  private async sendWebhook(webhookUrl: string, data: any): Promise<void> {
    try {
      // In a real implementation, you'd use fetch or axios
      // For now, just log the webhook data
      log.info(`Webhook would be sent to: ${webhookUrl}`, data);
      
      // TODO: Implement actual HTTP request
      // const response = await fetch(webhookUrl, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(data)
      // });
      
    } catch (error) {
      log.error(`Webhook failed for ${webhookUrl}:`, error);
      throw error;
    }
  }

  private async exportTranscription(filePath: string, result: any, formats: string[]): Promise<void> {
    const basePath = filePath.replace(path.extname(filePath), '');

    for (const format of formats) {
      try {
        let content = '';
        let extension = '';

        switch (format.toLowerCase()) {
          case 'txt':
            content = result.text;
            extension = '.txt';
            break;
          case 'srt':
            content = this.generateSRT(result.segments);
            extension = '.srt';
            break;
          case 'vtt':
            content = this.generateWebVTT(result.segments);
            extension = '.vtt';
            break;
          case 'json':
            content = JSON.stringify(result, null, 2);
            extension = '.json';
            break;
          default:
            log.warn(`Unsupported export format: ${format}`);
            continue;
        }

        const exportPath = `${basePath}${extension}`;
        await fs.writeFile(exportPath, content, 'utf8');
        log.info(`Exported transcription as ${format}: ${exportPath}`);

      } catch (error) {
        log.error(`Failed to export as ${format}:`, error);
      }
    }
  }

  private generateSRT(segments: any[]): string {
    // Simple SRT generation - would need more sophisticated implementation
    return segments.map((segment, index) => {
      const start = this.formatTime(segment.start);
      const end = this.formatTime(segment.end);
      return `${index + 1}\n${start} --> ${end}\n${segment.text}\n`;
    }).join('\n');
  }

  private generateWebVTT(segments: any[]): string {
    const srt = this.generateSRT(segments);
    return `WEBVTT\n\n${srt}`;
  }

  private formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }

  private sendNotification(message: string): void {
    // TODO: Implement desktop notifications
    log.info(`Notification: ${message}`);
  }

  async cleanup(): Promise<void> {
    log.info('Cleaning up WatchFolderService...');

    // Close all watchers
    for (const [ruleId, watcher] of this.watchers) {
      try {
        await watcher.close();
        log.info(`Closed watcher for rule: ${ruleId}`);
      } catch (error) {
        log.error(`Error closing watcher for rule ${ruleId}:`, error);
      }
    }

    this.watchers.clear();
    this.rules.clear();

    // Cleanup whisper service
    await this.whisperService.cleanup();

    log.info('WatchFolderService cleanup completed');
  }
}