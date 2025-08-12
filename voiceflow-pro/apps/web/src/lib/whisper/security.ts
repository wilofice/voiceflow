/**
 * Security utilities for Whisper implementation
 * Handles file validation, sanitization, and security checks
 */

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
  sanitized?: File;
}

export interface SecurityConfig {
  maxFileSize: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  scanForMalware: boolean;
  checkMagicBytes: boolean;
}

// Default security configuration
const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  maxFileSize: 2 * 1024 * 1024 * 1024, // 2GB
  allowedMimeTypes: [
    'audio/mpeg',
    'audio/wav',
    'audio/wave',
    'audio/x-wav',
    'audio/mp4',
    'audio/x-m4a',
    'audio/ogg',
    'audio/opus',
    'audio/flac',
    'audio/webm',
    'video/mp4',
    'video/quicktime',
  ],
  allowedExtensions: [
    '.mp3', '.wav', '.m4a', '.mp4', '.ogg', 
    '.opus', '.flac', '.webm', '.mov'
  ],
  scanForMalware: true,
  checkMagicBytes: true,
};

// Magic bytes for common audio formats
const MAGIC_BYTES: Record<string, Uint8Array[]> = {
  'audio/mpeg': [
    new Uint8Array([0xFF, 0xFB]), // MP3
    new Uint8Array([0xFF, 0xF3]), // MP3
    new Uint8Array([0xFF, 0xF2]), // MP3
    new Uint8Array([0x49, 0x44, 0x33]), // ID3
  ],
  'audio/wav': [
    new Uint8Array([0x52, 0x49, 0x46, 0x46]), // RIFF
  ],
  'audio/ogg': [
    new Uint8Array([0x4F, 0x67, 0x67, 0x53]), // OggS
  ],
  'audio/flac': [
    new Uint8Array([0x66, 0x4C, 0x61, 0x43]), // fLaC
  ],
  'video/mp4': [
    new Uint8Array([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]), // ftyp
    new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]), // ftyp
  ],
};

export class SecurityValidator {
  private config: SecurityConfig;

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = { ...DEFAULT_SECURITY_CONFIG, ...config };
  }

  /**
   * Validate an audio file for security issues
   */
  async validateFile(file: File): Promise<FileValidationResult> {
    const warnings: string[] = [];

    try {
      // 1. Check file size
      if (file.size > this.config.maxFileSize) {
        return {
          valid: false,
          error: `File size (${this.formatFileSize(file.size)}) exceeds maximum allowed size (${this.formatFileSize(this.config.maxFileSize)})`,
        };
      }

      // 2. Check file extension
      const extension = this.getFileExtension(file.name);
      if (!this.config.allowedExtensions.includes(extension.toLowerCase())) {
        return {
          valid: false,
          error: `File extension '${extension}' is not allowed. Allowed extensions: ${this.config.allowedExtensions.join(', ')}`,
        };
      }

      // 3. Check MIME type
      if (!this.config.allowedMimeTypes.includes(file.type)) {
        warnings.push(`MIME type '${file.type}' is not in the allowed list. File will be validated further.`);
      }

      // 4. Check magic bytes
      if (this.config.checkMagicBytes) {
        const magicValid = await this.checkMagicBytes(file);
        if (!magicValid) {
          return {
            valid: false,
            error: 'File content does not match expected audio format (invalid magic bytes)',
          };
        }
      }

      // 5. Scan for potential malware patterns
      if (this.config.scanForMalware) {
        const malwareCheck = await this.scanForMalware(file);
        if (!malwareCheck.safe) {
          return {
            valid: false,
            error: `Potential security threat detected: ${malwareCheck.threat}`,
          };
        }
      }

      // 6. Sanitize filename
      const sanitizedName = this.sanitizeFilename(file.name);
      if (sanitizedName !== file.name) {
        warnings.push('Filename has been sanitized for security');
      }

      // Create sanitized file if needed
      const sanitized = new File([file], sanitizedName, { type: file.type });

      return {
        valid: true,
        warnings: warnings.length > 0 ? warnings : undefined,
        sanitized,
      };

    } catch (error: any) {
      return {
        valid: false,
        error: `Security validation error: ${error.message}`,
      };
    }
  }

  /**
   * Check file magic bytes
   */
  private async checkMagicBytes(file: File): Promise<boolean> {
    // Read first 12 bytes of the file
    const buffer = await file.slice(0, 12).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Check against known magic bytes
    for (const [type, magicBytesList] of Object.entries(MAGIC_BYTES)) {
      for (const magicBytes of magicBytesList) {
        if (this.compareBytes(bytes, magicBytes)) {
          return true;
        }
      }
    }

    // Special case for WAV files (RIFF....WAVE)
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
      const waveBytes = await file.slice(8, 12).arrayBuffer();
      const waveArray = new Uint8Array(waveBytes);
      if (waveArray[0] === 0x57 && waveArray[1] === 0x41 && waveArray[2] === 0x56 && waveArray[3] === 0x45) {
        return true;
      }
    }

    return false;
  }

  /**
   * Compare byte arrays
   */
  private compareBytes(bytes: Uint8Array, pattern: Uint8Array): boolean {
    if (bytes.length < pattern.length) return false;
    
    for (let i = 0; i < pattern.length; i++) {
      if (bytes[i] !== pattern[i]) return false;
    }
    
    return true;
  }

  /**
   * Scan for potential malware patterns
   */
  private async scanForMalware(file: File): Promise<{ safe: boolean; threat?: string }> {
    // Read a sample of the file
    const sampleSize = Math.min(file.size, 1024 * 1024); // 1MB sample
    const buffer = await file.slice(0, sampleSize).arrayBuffer();
    const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /<script[^>]*>/gi,
      /<iframe[^>]*>/gi,
      /javascript:/gi,
      /eval\s*\(/gi,
      /new\s+Function\s*\(/gi,
      /document\.write/gi,
      /\.exe|\.dll|\.bat|\.cmd|\.com|\.scr|\.vbs|\.js/gi,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(text)) {
        return {
          safe: false,
          threat: `Suspicious pattern detected: ${pattern.source}`,
        };
      }
    }

    // Check for null bytes in text (common in exploits)
    if (text.includes('\0') && file.type.startsWith('audio/')) {
      // Null bytes are normal in binary audio files
      // But check if there are too many consecutive nulls
      const nullMatch = text.match(/\0{100,}/);
      if (nullMatch) {
        return {
          safe: false,
          threat: 'Excessive null bytes detected',
        };
      }
    }

    return { safe: true };
  }

  /**
   * Sanitize filename
   */
  private sanitizeFilename(filename: string): string {
    // Remove path components
    filename = filename.split(/[/\\]/).pop() || 'audio';

    // Remove special characters
    filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Remove multiple dots (prevent extension spoofing)
    filename = filename.replace(/\.{2,}/g, '.');

    // Limit length
    if (filename.length > 255) {
      const extension = this.getFileExtension(filename);
      const baseName = filename.substring(0, 255 - extension.length - 1);
      filename = baseName + extension;
    }

    // Ensure it has a valid extension
    const extension = this.getFileExtension(filename);
    if (!this.config.allowedExtensions.includes(extension.toLowerCase())) {
      filename += '.mp3'; // Default safe extension
    }

    return filename;
  }

  /**
   * Get file extension
   */
  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot >= 0 ? filename.substring(lastDot) : '';
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Create a content security policy for Whisper
   */
  static getContentSecurityPolicy(): string {
    return [
      "default-src 'self'",
      "script-src 'self' 'wasm-unsafe-eval' blob:",
      "worker-src 'self' blob:",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "media-src 'self' blob:",
      "connect-src 'self' https://huggingface.co https://cdn.jsdelivr.net",
      "object-src 'none'",
      "base-uri 'self'",
    ].join('; ');
  }

  /**
   * Validate browser compatibility
   */
  static checkBrowserCompatibility(): {
    compatible: boolean;
    missing: string[];
    warnings: string[];
  } {
    const missing: string[] = [];
    const warnings: string[] = [];

    // Required features
    if (!window.WebAssembly) {
      missing.push('WebAssembly');
    }

    if (!window.Worker) {
      missing.push('Web Workers');
    }

    if (!window.indexedDB) {
      missing.push('IndexedDB');
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      missing.push('getUserMedia (microphone access)');
    }

    // Optional but recommended features
    if (typeof AudioWorkletNode === 'undefined') {
      warnings.push('AudioWorklet not supported (using ScriptProcessor fallback)');
    }

    if (!('storage' in navigator)) {
      warnings.push('Storage API not supported (cannot estimate storage)');
    }

    // Check for SIMD support
    try {
      new WebAssembly.Module(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]));
    } catch {
      warnings.push('WebAssembly SIMD not supported (reduced performance)');
    }

    return {
      compatible: missing.length === 0,
      missing,
      warnings,
    };
  }
}

/**
 * Rate limiter for API calls
 */
export class RateLimiter {
  private requests: number[] = [];
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(maxRequests: number = 10, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Check if request is allowed
   */
  isAllowed(): boolean {
    const now = Date.now();
    
    // Remove old requests
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    // Check if under limit
    if (this.requests.length < this.maxRequests) {
      this.requests.push(now);
      return true;
    }
    
    return false;
  }

  /**
   * Get time until next request is allowed
   */
  getTimeUntilNextRequest(): number {
    if (this.requests.length < this.maxRequests) {
      return 0;
    }
    
    const oldestRequest = Math.min(...this.requests);
    const timeUntilOldestExpires = this.windowMs - (Date.now() - oldestRequest);
    
    return Math.max(0, timeUntilOldestExpires);
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.requests = [];
  }
}