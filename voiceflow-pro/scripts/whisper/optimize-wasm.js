#!/usr/bin/env node

/**
 * WASM Optimization Script
 * Optimizes the generated WASM files for production use
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

const WASM_DIR = path.join(__dirname, '../../apps/web/public/wasm');

// Configuration for optimization
const OPTIMIZATION_CONFIG = {
  // Compression settings
  compression: {
    enabled: true,
    algorithm: 'brotli', // or 'gzip'
    level: 11, // Maximum compression for brotli
  },
  
  // Code splitting settings
  splitting: {
    enabled: true,
    chunkSize: 1024 * 1024, // 1MB chunks
  },
  
  // Lazy loading configuration
  lazyLoading: {
    enabled: true,
    preloadModels: ['tiny'], // Models to preload
  },
};

/**
 * Generate SHA-256 hash for cache busting
 */
function generateFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex').substring(0, 8);
}

/**
 * Compress a file using Brotli or Gzip
 */
function compressFile(inputPath, algorithm = 'brotli') {
  console.log(`📦 Compressing ${path.basename(inputPath)} with ${algorithm}...`);
  
  if (algorithm === 'brotli') {
    // Use Node.js built-in brotli compression
    const zlib = require('zlib');
    const input = fs.readFileSync(inputPath);
    const compressed = zlib.brotliCompressSync(input, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: OPTIMIZATION_CONFIG.compression.level,
      },
    });
    const outputPath = `${inputPath}.br`;
    fs.writeFileSync(outputPath, compressed);
    
    const ratio = ((1 - compressed.length / input.length) * 100).toFixed(1);
    console.log(`   ✅ Compressed: ${ratio}% reduction`);
    
    return outputPath;
  } else if (algorithm === 'gzip') {
    execSync(`gzip -9 -k ${inputPath}`);
    return `${inputPath}.gz`;
  }
}

/**
 * Create a loader script for lazy loading WASM modules
 */
function createLoaderScript() {
  const loaderScript = `
// Whisper WASM Loader
// Handles lazy loading and caching of WASM modules

class WhisperWASMLoader {
  constructor() {
    this.cache = new Map();
    this.loading = new Map();
  }

  /**
   * Load a WASM module with caching
   */
  async loadModule(moduleName, options = {}) {
    // Check cache first
    if (this.cache.has(moduleName)) {
      return this.cache.get(moduleName);
    }

    // Check if already loading
    if (this.loading.has(moduleName)) {
      return this.loading.get(moduleName);
    }

    // Start loading
    const loadPromise = this._loadModuleImpl(moduleName, options);
    this.loading.set(moduleName, loadPromise);

    try {
      const module = await loadPromise;
      this.cache.set(moduleName, module);
      this.loading.delete(moduleName);
      return module;
    } catch (error) {
      this.loading.delete(moduleName);
      throw error;
    }
  }

  async _loadModuleImpl(moduleName, options) {
    const baseUrl = options.baseUrl || '/wasm/';
    const wasmUrl = \`\${baseUrl}\${moduleName}.wasm\`;
    const jsUrl = \`\${baseUrl}\${moduleName}.js\`;

    // Load the JavaScript wrapper
    const script = document.createElement('script');
    script.src = jsUrl;
    
    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });

    // Initialize the module
    const moduleFactory = window[\`create\${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}Module\`];
    if (!moduleFactory) {
      throw new Error(\`Module factory not found for \${moduleName}\`);
    }

    const module = await moduleFactory({
      locateFile: (path) => {
        if (path.endsWith('.wasm')) {
          return wasmUrl;
        }
        return path;
      },
      ...options.moduleConfig,
    });

    return module;
  }

  /**
   * Preload modules for better performance
   */
  async preloadModules(moduleNames) {
    const promises = moduleNames.map(name => 
      this.loadModule(name).catch(err => 
        console.warn(\`Failed to preload \${name}:\`, err)
      )
    );
    
    await Promise.all(promises);
  }

  /**
   * Clear cache to free memory
   */
  clearCache(moduleName) {
    if (moduleName) {
      this.cache.delete(moduleName);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get cache status
   */
  getCacheStatus() {
    return {
      cached: Array.from(this.cache.keys()),
      loading: Array.from(this.loading.keys()),
      cacheSize: this.cache.size,
    };
  }
}

// Create global instance
window.whisperLoader = new WhisperWASMLoader();

// Preload tiny model if configured
if (${OPTIMIZATION_CONFIG.lazyLoading.enabled}) {
  window.addEventListener('load', () => {
    const preloadModels = ${JSON.stringify(OPTIMIZATION_CONFIG.lazyLoading.preloadModels)};
    window.whisperLoader.preloadModules(preloadModels);
  });
}
`;

  fs.writeFileSync(path.join(WASM_DIR, 'whisper-loader.js'), loaderScript);
  console.log('✅ Created whisper-loader.js');
}

/**
 * Create service worker for caching WASM files
 */
function createServiceWorker() {
  const swScript = `
// Whisper Service Worker
// Caches WASM and model files for offline use

const CACHE_NAME = 'whisper-wasm-v1';
const MODEL_CACHE_NAME = 'whisper-models-v1';

// Files to cache immediately
const STATIC_CACHE_FILES = [
  '/wasm/whisper-loader.js',
  '/wasm/whisper-module.js',
];

// Model files are cached on demand
const MODEL_PATTERNS = [
  /\\/models\\/ggml-.*\\.bin$/,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_CACHE_FILES);
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Check if this is a WASM file
  if (url.pathname.includes('/wasm/') && url.pathname.endsWith('.wasm')) {
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) {
          return response;
        }

        return fetch(request).then((response) => {
          if (!response || response.status !== 200) {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });

          return response;
        });
      })
    );
    return;
  }

  // Check if this is a model file
  const isModelFile = MODEL_PATTERNS.some(pattern => pattern.test(url.pathname));
  if (isModelFile) {
    event.respondWith(
      caches.open(MODEL_CACHE_NAME).then((cache) => {
        return cache.match(request).then((response) => {
          if (response) {
            // Check if we should update the cache
            fetch(request).then((networkResponse) => {
              cache.put(request, networkResponse);
            });
            return response;
          }

          return fetch(request).then((response) => {
            if (response && response.status === 200) {
              const responseToCache = response.clone();
              cache.put(request, responseToCache);
            }
            return response;
          });
        });
      })
    );
  }
});

// Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== MODEL_CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
`;

  fs.writeFileSync(path.join(WASM_DIR, 'whisper-sw.js'), swScript);
  console.log('✅ Created whisper-sw.js (Service Worker)');
}

/**
 * Generate manifest for WASM files
 */
function generateManifest() {
  const files = fs.readdirSync(WASM_DIR);
  const manifest = {
    version: '1.0.0',
    generated: new Date().toISOString(),
    files: {},
  };

  files.forEach(file => {
    if (file.endsWith('.wasm') || file.endsWith('.js')) {
      const filePath = path.join(WASM_DIR, file);
      const stats = fs.statSync(filePath);
      const hash = generateFileHash(filePath);
      
      manifest.files[file] = {
        size: stats.size,
        hash: hash,
        compressed: fs.existsSync(`${filePath}.br`) || fs.existsSync(`${filePath}.gz`),
      };
    }
  });

  fs.writeFileSync(
    path.join(WASM_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  
  console.log('✅ Generated manifest.json');
}

/**
 * Main optimization function
 */
async function optimizeWASM() {
  console.log('🚀 Starting WASM optimization...\n');

  // Check if WASM files exist
  if (!fs.existsSync(WASM_DIR)) {
    console.error('❌ WASM directory not found. Run build-whisper-wasm.sh first.');
    process.exit(1);
  }

  // Compress WASM files
  if (OPTIMIZATION_CONFIG.compression.enabled) {
    const wasmFiles = fs.readdirSync(WASM_DIR).filter(f => f.endsWith('.wasm'));
    
    for (const file of wasmFiles) {
      const filePath = path.join(WASM_DIR, file);
      compressFile(filePath, OPTIMIZATION_CONFIG.compression.algorithm);
    }
  }

  // Create loader script
  createLoaderScript();

  // Create service worker
  createServiceWorker();

  // Generate manifest
  generateManifest();

  console.log('\n✅ WASM optimization complete!');
  console.log('\n📋 Next steps:');
  console.log('1. Configure your web server to serve .br files with Content-Encoding: br');
  console.log('2. Register the service worker in your app');
  console.log('3. Use whisper-loader.js for lazy loading modules');
}

// Run optimization
optimizeWASM().catch(console.error);