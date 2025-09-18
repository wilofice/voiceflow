/**
 * URL Validator Service
 * Validates URLs and detects content providers (YouTube, Vimeo, podcasts, etc.)
 */

import * as log from 'electron-log';
import { URL } from 'url';
import * as https from 'https';
import * as http from 'http';

export type Provider = 'youtube' | 'vimeo' | 'podcast' | 'direct' | 'soundcloud' | 'twitter' | 'unknown';

export interface ValidationResult {
  valid: boolean;
  provider: Provider | null;
  error?: string;
  metadata?: {
    title?: string;
    duration?: number;
    author?: string;
    thumbnail?: string;
  };
}

export class URLValidatorService {
  private readonly patterns: Record<Provider, RegExp> = {
    youtube: /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)[\w-]+/i,
    vimeo: /^(https?:\/\/)?(www\.)?vimeo\.com\/\d+/i,
    soundcloud: /^(https?:\/\/)?(www\.)?soundcloud\.com\/[\w-]+\/[\w-]+/i,
    twitter: /^(https?:\/\/)?(www\.)?(twitter|x)\.com\/[\w]+\/status\/\d+/i,
    podcast: /\.(mp3|m4a|aac|ogg|opus|wav)(\?.*)?$/i,
    direct: /^https?:\/\/.+\.(mp4|webm|mov|avi|mkv|flac|wav|m4a|mp3)(\?.*)?$/i,
    unknown: /^$/  // Never matches, placeholder
  };

  /**
   * Detect the provider from a URL
   */
  detectProvider(url: string): Provider {
    // Clean and normalize URL
    const cleanUrl = url.trim();
    
    // Check each pattern
    for (const [provider, pattern] of Object.entries(this.patterns)) {
      if (provider === 'unknown') continue;
      if (pattern.test(cleanUrl)) {
        log.info(`URLValidator: Detected provider ${provider} for URL: ${cleanUrl}`);
        return provider as Provider;
      }
    }
    
    // Check if it's a podcast feed (RSS/XML)
    if (/\.(rss|xml)(\?.*)?$/i.test(cleanUrl) || cleanUrl.includes('/feed')) {
      return 'podcast';
    }
    
    return 'unknown';
  }

  /**
   * Extract video/audio ID from provider URLs
   */
  extractId(url: string, provider: Provider): string | null {
    switch (provider) {
      case 'youtube': {
        const match = url.match(/(?:v=|youtu\.be\/)([^&\s]+)/);
        return match ? match[1] : null;
      }
      case 'vimeo': {
        const match = url.match(/vimeo\.com\/(\d+)/);
        return match ? match[1] : null;
      }
      case 'twitter': {
        const match = url.match(/status\/(\d+)/);
        return match ? match[1] : null;
      }
      default:
        return null;
    }
  }

  /**
   * Validate a URL and return detailed information
   */
  async validateURL(url: string): Promise<ValidationResult> {
    try {
      // Basic URL validation
      if (!url || url.length < 10) {
        return { 
          valid: false, 
          provider: null, 
          error: 'Invalid URL: Too short or empty' 
        };
      }

      // Detect provider
      const provider = this.detectProvider(url);
      
      if (provider === 'unknown') {
        return { 
          valid: false, 
          provider: null, 
          error: 'Unsupported URL format. Supported: YouTube, Vimeo, SoundCloud, podcasts, and direct media files.' 
        };
      }

      // Provider-specific validation
      switch (provider) {
        case 'youtube':
          return await this.validateYouTube(url);
        case 'vimeo':
          return await this.validateVimeo(url);
        case 'soundcloud':
          return await this.validateSoundCloud(url);
        case 'podcast':
        case 'direct':
          return await this.validateDirectURL(url, provider);
        default:
          return { valid: true, provider };
      }
    } catch (error) {
      log.error('URLValidator: Validation error:', error);
      return { 
        valid: false, 
        provider: null, 
        error: error instanceof Error ? error.message : 'Validation failed' 
      };
    }
  }

  /**
   * Validate YouTube URL
   */
  private async validateYouTube(url: string): Promise<ValidationResult> {
    const videoId = this.extractId(url, 'youtube');
    
    if (!videoId) {
      return { 
        valid: false, 
        provider: 'youtube', 
        error: 'Invalid YouTube URL: Could not extract video ID' 
      };
    }

    // We'll do a simple check - actual metadata will be fetched by yt-dlp
    return {
      valid: true,
      provider: 'youtube',
      metadata: {
        // Placeholder - will be filled by yt-dlp
        title: `YouTube Video ${videoId}`
      }
    };
  }

  /**
   * Validate Vimeo URL
   */
  private async validateVimeo(url: string): Promise<ValidationResult> {
    const videoId = this.extractId(url, 'vimeo');
    
    if (!videoId) {
      return { 
        valid: false, 
        provider: 'vimeo', 
        error: 'Invalid Vimeo URL: Could not extract video ID' 
      };
    }

    return {
      valid: true,
      provider: 'vimeo',
      metadata: {
        title: `Vimeo Video ${videoId}`
      }
    };
  }

  /**
   * Validate SoundCloud URL
   */
  private async validateSoundCloud(url: string): Promise<ValidationResult> {
    // SoundCloud URLs are complex, we'll let yt-dlp handle the details
    return {
      valid: true,
      provider: 'soundcloud'
    };
  }

  /**
   * Validate direct media URL or podcast feed
   */
  private async validateDirectURL(url: string, provider: Provider): Promise<ValidationResult> {
    return new Promise((resolve) => {
      try {
        const urlObj = new URL(url);
        const client = urlObj.protocol === 'https:' ? https : http;
        
        // Make a HEAD request to check if the URL is accessible
        const req = client.request({
          method: 'HEAD',
          hostname: urlObj.hostname,
          path: urlObj.pathname + urlObj.search,
          timeout: 5000
        }, (res) => {
          const valid = res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 400;
          
          if (!valid) {
            resolve({
              valid: false,
              provider,
              error: `URL returned status code: ${res.statusCode}`
            });
            return;
          }

          // Check content type for media files
          const contentType = res.headers['content-type'] || '';
          const contentLength = res.headers['content-length'];
          
          // Validate content type for direct media
          if (provider === 'direct') {
            const validTypes = ['audio/', 'video/'];
            const hasValidType = validTypes.some(type => contentType.includes(type));
            
            if (!hasValidType && !this.patterns.direct.test(url)) {
              resolve({
                valid: false,
                provider,
                error: `Invalid content type: ${contentType}`
              });
              return;
            }
          }

          resolve({
            valid: true,
            provider,
            metadata: {
              title: urlObj.pathname.split('/').pop()?.replace(/\.\w+$/, '') || 'Media File'
            }
          });
        });

        req.on('error', (error) => {
          resolve({
            valid: false,
            provider,
            error: `Connection failed: ${error.message}`
          });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({
            valid: false,
            provider,
            error: 'Connection timeout'
          });
        });

        req.end();
      } catch (error) {
        resolve({
          valid: false,
          provider,
          error: error instanceof Error ? error.message : 'Invalid URL'
        });
      }
    });
  }

  /**
   * Check if URL requires authentication
   */
  async requiresAuth(url: string): Promise<boolean> {
    const provider = this.detectProvider(url);
    
    // Some providers may require cookies or authentication
    if (provider === 'vimeo') {
      // Check if it's a private/protected video
      return url.includes('/private/') || url.includes('/protect/');
    }
    
    return false;
  }

  /**
   * Get suggested filename from URL
   */
  getSuggestedFilename(url: string, provider: Provider): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    switch (provider) {
      case 'youtube': {
        const id = this.extractId(url, provider);
        return `youtube_${id}_${timestamp}`;
      }
      case 'vimeo': {
        const id = this.extractId(url, provider);
        return `vimeo_${id}_${timestamp}`;
      }
      case 'direct':
      case 'podcast': {
        try {
          const urlObj = new URL(url);
          const filename = urlObj.pathname.split('/').pop()?.replace(/\.\w+$/, '');
          return filename || `download_${timestamp}`;
        } catch {
          return `download_${timestamp}`;
        }
      }
      default:
        return `${provider}_${timestamp}`;
    }
  }
}