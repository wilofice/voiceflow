import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

import { app, BrowserWindow, screen, session } from 'electron';
import * as log from 'electron-log';
import Store from 'electron-store';

interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  maximized?: boolean;
}

export class WindowManager {
  private store: Store<any>;
  private windows: Map<string, BrowserWindow> = new Map();
  private readonly isDevelopment: boolean;

  constructor(store: Store<any>) {
    this.store = store;
    this.isDevelopment = process.env.NODE_ENV === 'development' || !app.isPackaged;
  }

  async createMainWindow(): Promise<BrowserWindow> {
    log.info('Creating main window...');

    // Get saved window state
    const savedState = this.store.get('windowState', {
      width: 1200,
      height: 800
    }) as WindowState;

    // Get primary display
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    // Ensure window fits on screen
    const windowWidth = Math.min(savedState.width, screenWidth - 100);
    const windowHeight = Math.min(savedState.height, screenHeight - 100);

    // Center window if no saved position
    const windowX = savedState.x !== undefined ? savedState.x : Math.floor((screenWidth - windowWidth) / 2);
    const windowY = savedState.y !== undefined ? savedState.y : Math.floor((screenHeight - windowHeight) / 2);

    const mainWindow = new BrowserWindow({
      width: windowWidth,
      height: windowHeight,
      x: windowX,
      y: windowY,
      minWidth: 800,
      minHeight: 600,
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      show: false, // Don't show until ready
      webPreferences: {
        nodeIntegration: false, // Security best practice
        contextIsolation: true, // Required for preload contextBridge
        // enableRemoteModule: false, // Security best practice (deprecated in newer Electron)
        webSecurity: true,
        preload: path.join(__dirname, '../preload/index.js')
      },
      icon: this.getAppIcon()
    });

    // Set Content Security Policy to allow development tooling
    const scriptSrc = ["'self'", "'unsafe-inline'", "'unsafe-eval'"];
    const styleSrc = ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'];
    const fontSrc = ["'self'", 'https://fonts.gstatic.com'];
    const imgSrc = ["'self'", 'data:', 'https:'];
    const connectSrc = [
      "'self'",
      'http://localhost:3002',
      'https://localhost:3002',
      'ws://localhost:3002',
      'wss://localhost:3002'
    ];

    if (this.isDevelopment) {
      scriptSrc.push('chrome-extension://*', 'devtools://*', 'http://localhost:8097');
      styleSrc.push('chrome-extension://*', 'devtools://*');
      connectSrc.push(
        'http://localhost:3000',
        'https://localhost:3000',
        'ws://localhost:3000',
        'wss://localhost:3000',
        'http://localhost:8097',
        'ws://localhost:8097'
      );
    }

    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            `default-src 'self'`,
            `script-src ${scriptSrc.join(' ')}`,
            `style-src ${styleSrc.join(' ')}`,
            `style-src-elem ${styleSrc.join(' ')}`,
            `font-src ${fontSrc.join(' ')}`,
            `img-src ${imgSrc.join(' ')}`,
            `connect-src ${connectSrc.join(' ')}`
          ].join('; ')
        }
      });
    });

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
      if (savedState.maximized) {
        mainWindow.maximize();
      }
      mainWindow.show();
      
      // Focus the window
      if (process.platform === 'darwin') {
        mainWindow.focus();
      }
    });

    // Save window state when it changes
    const saveWindowState = () => {
      if (mainWindow.isDestroyed()) return;

      const bounds = mainWindow.getBounds();
      const isMaximized = mainWindow.isMaximized();

      this.store.set('windowState', {
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        maximized: isMaximized
      });
    };

    // Listen for window state changes
    mainWindow.on('resize', saveWindowState);
    mainWindow.on('move', saveWindowState);
    mainWindow.on('maximize', saveWindowState);
    mainWindow.on('unmaximize', saveWindowState);

    // Handle window closed
    mainWindow.on('closed', () => {
      this.windows.delete('main');
      log.info('Main window closed');
    });

    // Store reference
    this.windows.set('main', mainWindow);

    // Install React DevTools in development
    if (this.isDevelopment) {
      // Create extensions directory if it doesn't exist
      const extensionsPath = path.join(
        app.getPath('userData'),
        'extensions'
      );

      if (!fs.existsSync(extensionsPath)) {
        log.info(`📁 Creating extensions directory: ${extensionsPath}`);
        fs.mkdirSync(extensionsPath, { recursive: true });
      }

      mainWindow.webContents.once('dom-ready', async () => {
        try {
          log.info('📦 Installing React DevTools...');
          log.info(`   Using session: ${mainWindow.webContents.session === session.defaultSession ? 'default' : 'custom'}`);

          const { default: installExtension, REACT_DEVELOPER_TOOLS } = await import('electron-devtools-installer');

          const extension = await installExtension(REACT_DEVELOPER_TOOLS, {
            loadExtensionOptions: {
              allowFileAccess: true,
            },
            forceDownload: false,
            session: mainWindow.webContents.session
          });

          // Extension returns an object with 'name' and 'id' properties
          log.info(`✅ React DevTools installed successfully!`);
          log.info(`   Name: ${extension.name}`);
          log.info(`   ID: ${extension.id}`);

          // Verify extension is loaded
          const loadedExtensions = mainWindow.webContents.session.getAllExtensions();
          log.info(`   Loaded extensions: ${Object.keys(loadedExtensions).length}`);
          Object.values(loadedExtensions).forEach((ext: any) => {
            log.info(`      - ${ext.name} (${ext.id})`);
          });
        } catch (error) {
          log.error('❌ React DevTools installation failed:', error);
          if (error instanceof Error) {
            log.error(`   Error details: ${error.message}`);
          }
        }
      });
    }

    log.info('Main window created successfully');
    return mainWindow;
  }

  async createTranscriptWindow(transcriptId: string): Promise<BrowserWindow> {
    log.info(`Creating transcript window for: ${transcriptId}`);

    const transcriptWindow = new BrowserWindow({
      width: 1000,
      height: 700,
      minWidth: 600,
      minHeight: 400,
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      show: false,
      parent: this.windows.get('main'), // Make it a child of main window
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        // enableRemoteModule: false, // Deprecated
        webSecurity: true,
        preload: path.join(__dirname, '../preload/index.js')
      },
      icon: this.getAppIcon()
    });

    // Show when ready
    transcriptWindow.once('ready-to-show', () => {
      transcriptWindow.show();
    });

    // Handle window closed
    transcriptWindow.on('closed', () => {
      this.windows.delete(`transcript-${transcriptId}`);
      log.info(`Transcript window closed: ${transcriptId}`);
    });

    // Store reference
    this.windows.set(`transcript-${transcriptId}`, transcriptWindow);

    return transcriptWindow;
  }

  async createSettingsWindow(): Promise<BrowserWindow> {
    log.info('Creating settings window...');

    // Don't create multiple settings windows
    const existingSettings = this.windows.get('settings');
    if (existingSettings && !existingSettings.isDestroyed()) {
      existingSettings.focus();
      return existingSettings;
    }

    const settingsWindow = new BrowserWindow({
      width: 800,
      height: 600,
      resizable: false,
      minimizable: false,
      maximizable: false,
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      show: false,
      parent: this.windows.get('main'),
      modal: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        // enableRemoteModule: false, // Deprecated
        webSecurity: true,
        preload: path.join(__dirname, '../preload/index.js')
      },
      icon: this.getAppIcon()
    });

    settingsWindow.once('ready-to-show', () => {
      settingsWindow.show();
    });

    settingsWindow.on('closed', () => {
      this.windows.delete('settings');
      log.info('Settings window closed');
    });

    this.windows.set('settings', settingsWindow);

    return settingsWindow;
  }

  getWindow(id: string): BrowserWindow | undefined {
    return this.windows.get(id);
  }

  getAllWindows(): BrowserWindow[] {
    return Array.from(this.windows.values());
  }

  closeWindow(id: string): void {
    const window = this.windows.get(id);
    if (window && !window.isDestroyed()) {
      window.close();
    }
  }

  closeAllWindows(): void {
    for (const window of this.windows.values()) {
      if (!window.isDestroyed()) {
        window.close();
      }
    }
  }

  private getAppIcon(): string | undefined {
    // Return appropriate icon path based on platform
    if (process.platform === 'win32') {
      return path.join(__dirname, '../assets/icon.ico');
    } else if (process.platform === 'darwin') {
      return path.join(__dirname, '../assets/icon.icns');
    } else {
      return path.join(__dirname, '../assets/icon.png');
    }
  }
}