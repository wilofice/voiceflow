/**
 * File Import Service
 * Handles native file operations, drag-drop, and batch processing
 * Task 1.3: File Import System Implementation
 */

import { EventEmitter } from 'events';
import * as path from 'path';

import { dialog, shell, BrowserWindow, ipcMain } from 'electron';
import * as log from 'electron-log';
import * as fs from 'fs-extra';
import * as mime from 'mime-types';

export interface FileInfo {
    path: string;
    name: string;
    size: number;
    type: string;
    extension: string;
    mimeType?: string;
    duration?: number; // For audio/video files
    isValid: boolean;
    error?: string;
}

export interface ImportResult {
    success: boolean;
    files: FileInfo[];
    totalSize: number;
    errors: string[];
}

export interface ImportOptions {
    validateFiles?: boolean;
    maxFileSize?: number; // in bytes
    allowedFormats?: string[];
    outputDirectory?: string;
    preserveStructure?: boolean;
}

export class FileImportService extends EventEmitter {
    private readonly supportedAudioFormats = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac', '.opus', '.wma'];
    private readonly supportedVideoFormats = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
    private readonly maxFileSizeDefault = 500 * 1024 * 1024; // 500MB default
    private importQueue: FileInfo[] = [];
    private isProcessing = false;

    constructor() {
        super();
        log.info('FileImportService initialized');
    }

    /**
     * Get all supported formats
     */
    getSupportedFormats(): string[] {
        return [...this.supportedAudioFormats, ...this.supportedVideoFormats];
    }

    /**
     * Check if a file format is supported
     */
    isFormatSupported(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        return this.getSupportedFormats().includes(ext);
    }

    /**
     * Show native file open dialog
     */
    async showOpenDialog(options?: Partial<ImportOptions>): Promise<ImportResult> {
        log.info('FileImportService: Opening file dialog');
        
        const dialogResult = await dialog.showOpenDialog({
            properties: ['openFile', 'multiSelections'],
            filters: [
                { 
                    name: 'Audio Files', 
                    extensions: this.supportedAudioFormats.map(ext => ext.slice(1))
                },
                { 
                    name: 'Video Files', 
                    extensions: this.supportedVideoFormats.map(ext => ext.slice(1))
                },
                { name: 'All Supported', extensions: ['*'] }
            ],
            title: 'Select Audio/Video Files to Import'
        });

        if (dialogResult.canceled || !dialogResult.filePaths?.length) {
            return {
                success: false,
                files: [],
                totalSize: 0,
                errors: ['No files selected']
            };
        }

        return this.importFiles(dialogResult.filePaths, options);
    }

    /**
     * Show folder selection dialog
     */
    async showFolderDialog(options?: Partial<ImportOptions>): Promise<ImportResult> {
        log.info('FileImportService: Opening folder dialog');
        
        const dialogResult = await dialog.showOpenDialog({
            properties: ['openDirectory'],
            title: 'Select Folder to Import Audio/Video Files'
        });

        if (dialogResult.canceled || !dialogResult.filePaths?.length) {
            return {
                success: false,
                files: [],
                totalSize: 0,
                errors: ['No folder selected']
            };
        }

        const folderPath = dialogResult.filePaths[0];
        const files = await this.scanFolder(folderPath, options?.preserveStructure);
        
        return this.importFiles(files, options);
    }

    /**
     * Import files with validation and processing
     */
    async importFiles(filePaths: string[], options?: Partial<ImportOptions>): Promise<ImportResult> {
        log.info(`FileImportService: Importing ${filePaths.length} files`);
        
        const opts: ImportOptions = {
            validateFiles: true,
            maxFileSize: this.maxFileSizeDefault,
            allowedFormats: this.getSupportedFormats(),
            ...options
        };

        const result: ImportResult = {
            success: true,
            files: [],
            totalSize: 0,
            errors: []
        };

        for (const filePath of filePaths) {
            try {
                const fileInfo = await this.processFile(filePath, opts);
                
                if (fileInfo.isValid) {
                    result.files.push(fileInfo);
                    result.totalSize += fileInfo.size;
                    
                    // Emit progress event
                    this.emit('file:imported', fileInfo);
                } else {
                    result.errors.push(fileInfo.error || `Invalid file: ${filePath}`);
                    this.emit('file:error', { path: filePath, error: fileInfo.error });
                }
            } catch (error) {
                const errorMsg = `Failed to process ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
                result.errors.push(errorMsg);
                log.error(errorMsg);
            }
        }

        result.success = result.errors.length === 0;
        
        // Emit completion event
        this.emit('import:complete', result);
        
        log.info(`FileImportService: Import complete. ${result.files.length} files imported, ${result.errors.length} errors`);
        
        return result;
    }

    /**
     * Process a single file
     */
    private async processFile(filePath: string, options: ImportOptions): Promise<FileInfo> {
        const stats = await fs.stat(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const fileName = path.basename(filePath);
        
        const fileInfo: FileInfo = {
            path: filePath,
            name: fileName,
            size: stats.size,
            type: this.getFileType(ext),
            extension: ext,
            mimeType: mime.lookup(filePath) || undefined,
            isValid: false
        };

        // Validate file format
        if (options.allowedFormats && !options.allowedFormats.includes(ext)) {
            fileInfo.error = `Unsupported format: ${ext}`;
            return fileInfo;
        }

        // Validate file size
        if (options.maxFileSize && stats.size > options.maxFileSize) {
            fileInfo.error = `File too large: ${(stats.size / 1024 / 1024).toFixed(2)}MB (max: ${(options.maxFileSize / 1024 / 1024).toFixed(2)}MB)`;
            return fileInfo;
        }

        // Additional validation
        if (options.validateFiles) {
            const validationResult = await this.validateFile(filePath);
            if (!validationResult.isValid) {
                fileInfo.error = validationResult.error;
                return fileInfo;
            }
            
            // Add duration if available
            if (validationResult.duration) {
                fileInfo.duration = validationResult.duration;
            }
        }

        fileInfo.isValid = true;
        return fileInfo;
    }

    /**
     * Validate file integrity and readability
     */
    private async validateFile(filePath: string): Promise<{ isValid: boolean; error?: string; duration?: number }> {
        try {
            // Check if file is readable
            await fs.access(filePath, fs.constants.R_OK);
            
            // For audio/video files, we could use ffprobe to get duration and validate
            // For now, we'll do a simple check
            const stats = await fs.stat(filePath);
            if (stats.size === 0) {
                return { isValid: false, error: 'File is empty' };
            }
            
            // TODO: Add ffprobe integration for duration and codec validation
            
            return { isValid: true };
        } catch (error) {
            return { 
                isValid: false, 
                error: `File validation failed: ${error instanceof Error ? error.message : String(error)}` 
            };
        }
    }

    /**
     * Scan folder recursively for media files
     */
    private async scanFolder(folderPath: string, preserveStructure?: boolean): Promise<string[]> {
        const files: string[] = [];
        
        async function scan(dir: string) {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory()) {
                    // Recursively scan subdirectories
                    await scan(fullPath);
                } else if (entry.isFile()) {
                    files.push(fullPath);
                }
            }
        }
        
        await scan(folderPath);
        
        // Filter for supported formats
        return files.filter(file => this.isFormatSupported(file));
    }

    /**
     * Get file type category
     */
    private getFileType(extension: string): 'audio' | 'video' | 'unknown' {
        if (this.supportedAudioFormats.includes(extension)) {
            return 'audio';
        }
        if (this.supportedVideoFormats.includes(extension)) {
            return 'video';
        }
        return 'unknown';
    }


    /**
     * Open file in default application
     */
    async openFile(filePath: string): Promise<void> {
        await shell.openPath(filePath);
    }

    /**
     * Reveal file in file manager
     */
    async revealFile(filePath: string): Promise<void> {
        shell.showItemInFolder(filePath);
    }

    /**
     * Get import queue
     */
    getImportQueue(): FileInfo[] {
        return this.importQueue;
    }

    /**
     * Clear import queue
     */
    clearImportQueue(): void {
        this.importQueue = [];
        this.emit('queue:cleared');
    }

    /**
     * Batch import with progress tracking
     */
    async batchImport(filePaths: string[], options?: Partial<ImportOptions>): Promise<ImportResult> {
        if (this.isProcessing) {
            throw new Error('Import already in progress');
        }

        this.isProcessing = true;
        this.emit('import:start', { total: filePaths.length });

        try {
            const result = await this.importFiles(filePaths, options);
            this.emit('import:finish', result);
            return result;
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Export file metadata to JSON
     */
    async exportMetadata(files: FileInfo[], outputPath: string): Promise<void> {
        const metadata = {
            exportDate: new Date().toISOString(),
            totalFiles: files.length,
            totalSize: files.reduce((sum, f) => sum + f.size, 0),
            files: files.map(f => ({
                name: f.name,
                path: f.path,
                size: f.size,
                type: f.type,
                extension: f.extension,
                mimeType: f.mimeType,
                duration: f.duration
            }))
        };

        await fs.writeJson(outputPath, metadata, { spaces: 2 });
        log.info(`FileImportService: Metadata exported to ${outputPath}`);
    }
}