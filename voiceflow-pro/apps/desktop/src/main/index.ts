import * as path from 'path';

import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron';
import contextMenu from 'electron-context-menu';
import * as log from 'electron-log';
import Store from 'electron-store';
import { autoUpdater } from 'electron-updater';

// Import our services
import { setupIPC } from './ipc/handlers';
import { setupURLIngestHandlers } from './ipc/urlIngestHandlers';
import { DesktopWhisperService } from './services/desktopWhisperService';
import { FileImportService } from './services/fileImportService';
import { SecureStorageService } from './services/secureStorageService';
import { URLIngestService } from './services/urlIngest/urlIngestService';
import { WatchFolderService } from './services/watchFolderService';
import { WindowManager } from './services/windowManager';

// Configure logging
log.transports.console.level = 'debug';
log.transports.file.level = 'info';

class VoiceFlowProApp {
    private windowManager: WindowManager;
    private whisperService: DesktopWhisperService;
    private fileImportService: FileImportService;
    private watchFolderService: WatchFolderService;
    private urlIngestService: URLIngestService;
    private secureStorageService: SecureStorageService;
    private store: Store<any>;

    constructor() {
        this.store = new Store({
            defaults: {
                windowState: {
                    width: 1200,
                    height: 800
                },
                preferences: {
                    defaultModel: 'base',
                    defaultLanguage: 'auto',
                    theme: 'system'
                }
            }
        });

        this.windowManager = new WindowManager(this.store);
        this.whisperService = new DesktopWhisperService();
        this.fileImportService = new FileImportService();
        this.watchFolderService = new WatchFolderService();
        this.urlIngestService = new URLIngestService();
        this.secureStorageService = SecureStorageService.getInstance();
    }

    async initialize() {
        log.info('Initializing VoiceFlowPro Desktop App');

        // Wait for Electron to be ready
        await app.whenReady();

        // Initialize services
        await this.initializeServices();

        // Set up IPC handlers
        this.setupIPC();

        // Create the main window
        await this.createMainWindow();

        // Set up application menu
        this.setupMenu();

        // Set up context menu
        this.setupContextMenu();

        // Set up auto-updater (in production)
        if (!process.env.NODE_ENV || process.env.NODE_ENV === 'production') {
            this.setupAutoUpdater();
        }

        // Handle app activation (macOS)
        app.on('activate', async () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                await this.createMainWindow();
            }
        });

        // Handle window close
        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                app.quit();
            }
        });

        // Handle before quit
        app.on('before-quit', async () => {
            await this.cleanup();
        });

        log.info('VoiceFlowPro Desktop App initialized successfully');
    }

    private async initializeServices() {
        try {
            // Try to initialize services, but don't fail if WhisperService has issues
            try {
                await this.whisperService.initialize();
                log.info('WhisperService initialized successfully');
            } catch (error) {
                log.warn('WhisperService initialization failed (will retry on first use):', error);
                // Continue - we can initialize it later when actually needed
            }
            
            try {
                await this.watchFolderService.initialize();
                log.info('WatchFolderService initialized successfully');
            } catch (error) {
                log.warn('WatchFolderService initialization failed:', error);
            }

            // Initialize URL ingest service with whisper
            this.urlIngestService.setWhisperService(this.whisperService);
            log.info('URLIngestService initialized with WhisperService');
            
            log.info('Services initialization completed');
        } catch (error) {
            log.error('Critical error during services initialization:', error);
            throw error;
        }
    }

    private setupIPC() {
        // Set up IPC handlers for communication with renderer
        setupIPC({
            whisper: this.whisperService,
            fileImport: this.fileImportService,
            watchFolder: this.watchFolderService,
            store: this.store,
            windowManager: this.windowManager,
            secureStorage: this.secureStorageService
        });

        // Set up URL ingest handlers
        setupURLIngestHandlers(this.urlIngestService);
    }

    private async createMainWindow() {
        const mainWindow = await this.windowManager.createMainWindow();
        
        // Load the app
        if (process.env.NODE_ENV === 'development') {
            // In development, load from the web dev server if available
            // Otherwise load the built renderer
            try {
                await mainWindow.loadURL('http://localhost:3000');
                mainWindow.webContents.openDevTools();
            } catch {
                await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
            }
        } else {
            await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
        }
    }

    private setupMenu() {
        const template: Electron.MenuItemConstructorOptions[] = [
            {
                label: 'File',
                submenu: [
                    {
                        label: 'Open Audio File...',
                        accelerator: 'CmdOrCtrl+O',
                        click: async () => {
                            const result = await dialog.showOpenDialog({
                                properties: ['openFile', 'multiSelections'],
                                filters: [
                                    { name: 'Audio Files', extensions: ['mp3', 'wav', 'm4a', 'ogg', 'flac'] },
                                    { name: 'Video Files', extensions: ['mp4', 'mov', 'avi'] },
                                    { name: 'All Files', extensions: ['*'] }
                                ]
                            });

                            if (!result.canceled) {
                                // Send file paths to renderer
                                const focusedWindow = BrowserWindow.getFocusedWindow();
                                if (focusedWindow) {
                                    focusedWindow.webContents.send('files:selected', result.filePaths);
                                }
                            }
                        }
                    },
                    { type: 'separator' },
                    {
                        label: 'Add Watch Folder...',
                        accelerator: 'CmdOrCtrl+Shift+O',
                        click: async () => {
                            const result = await dialog.showOpenDialog({
                                properties: ['openDirectory']
                            });

                            if (!result.canceled) {
                                const focusedWindow = BrowserWindow.getFocusedWindow();
                                if (focusedWindow) {
                                    focusedWindow.webContents.send('watch-folder:selected', result.filePaths[0]);
                                }
                            }
                        }
                    },
                    { type: 'separator' },
                    {
                        role: 'quit'
                    }
                ]
            },
            {
                label: 'Edit',
                submenu: [
                    { role: 'undo' },
                    { role: 'redo' },
                    { type: 'separator' },
                    { role: 'cut' },
                    { role: 'copy' },
                    { role: 'paste' },
                    { role: 'selectAll' }
                ]
            },
            {
                label: 'View',
                submenu: [
                    { role: 'reload' },
                    { role: 'forceReload' },
                    { role: 'toggleDevTools' },
                    { type: 'separator' },
                    { role: 'resetZoom' },
                    { role: 'zoomIn' },
                    { role: 'zoomOut' },
                    { type: 'separator' },
                    { role: 'togglefullscreen' }
                ]
            },
            {
                label: 'Window',
                submenu: [
                    { role: 'minimize' },
                    { role: 'close' }
                ]
            }
        ];

        // macOS specific menu adjustments
        if (process.platform === 'darwin') {
            template.unshift({
                label: app.getName(),
                submenu: [
                    { role: 'about' },
                    { type: 'separator' },
                    {
                        label: 'Preferences...',
                        accelerator: 'Cmd+,',
                        click: () => {
                            const focusedWindow = BrowserWindow.getFocusedWindow();
                            if (focusedWindow) {
                                focusedWindow.webContents.send('menu:preferences');
                            }
                        }
                    },
                    { type: 'separator' },
                    { role: 'services' },
                    { type: 'separator' },
                    { role: 'hide' },
                    { role: 'hideOthers' },
                    { role: 'unhide' },
                    { type: 'separator' },
                    { role: 'quit' }
                ]
            });

            // Window menu for macOS
            (template[4].submenu as Electron.MenuItemConstructorOptions[]).push(
                { type: 'separator' },
                { role: 'front' }
            );
        }

        const menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);
    }

    private setupContextMenu() {
        contextMenu({
            showSaveImageAs: true,
            showCopyImage: true,
            showSearchWithGoogle: false,
            prepend: (defaultActions, params, browserWindow) => [
                {
                    label: 'Transcribe Audio',
                    visible: params.mediaType === 'audio',
                    click: () => {
                        // Handle transcription of audio element
                        if (browserWindow && 'webContents' in browserWindow) {
                            browserWindow.webContents.send('context-menu:transcribe-audio', params.srcURL);
                        }
                    }
                }
            ]
        });
    }

    private setupAutoUpdater() {
        autoUpdater.logger = log;
        
        autoUpdater.on('checking-for-update', () => {
            log.info('Checking for update...');
        });

        autoUpdater.on('update-available', (info) => {
            log.info('Update available:', info);
        });

        autoUpdater.on('update-not-available', (info) => {
            log.info('Update not available:', info);
        });

        autoUpdater.on('error', (err) => {
            log.error('Error in auto-updater:', err);
        });

        autoUpdater.on('download-progress', (progressObj) => {
            let log_message = `Download speed: ${progressObj.bytesPerSecond}`;
            log_message += ` - Downloaded ${progressObj.percent}%`;
            log_message += ` (${progressObj.transferred}/${progressObj.total})`;
            log.info(log_message);
        });

        autoUpdater.on('update-downloaded', (info) => {
            log.info('Update downloaded');
            // Notify user and restart
            autoUpdater.quitAndInstall();
        });

        // Check for updates
        autoUpdater.checkForUpdatesAndNotify();
    }

    private async cleanup() {
        log.info('Cleaning up application...');
        try {
            await this.watchFolderService.cleanup();
            await this.whisperService.cleanup();
            await this.urlIngestService.cleanup();
            log.info('Cleanup completed');
        } catch (error) {
            log.error('Error during cleanup:', error);
        }
    }
}

// Create and initialize the app
const voiceFlowApp = new VoiceFlowProApp();

// Handle app errors
process.on('uncaughtException', (error) => {
    log.error('Uncaught exception:', error);
    app.quit();
});

process.on('unhandledRejection', (reason, promise) => {
    log.error('Unhandled rejection at:', promise, 'reason:', reason);
});

// Initialize the app
voiceFlowApp.initialize().catch((error) => {
    log.error('Failed to initialize app:', error);
    app.quit();
});