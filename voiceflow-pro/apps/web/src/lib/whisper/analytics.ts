/**
 * Analytics and Error Logging for Whisper Implementation
 * Tracks usage, performance, and errors for optimization
 */

export interface AnalyticsEvent {
  event: string;
  properties?: Record<string, any>;
  timestamp: Date;
  sessionId: string;
  userId?: string;
}

export interface ErrorLog {
  error: Error;
  context: Record<string, any>;
  timestamp: Date;
  sessionId: string;
  userId?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  tags?: Record<string, string>;
  timestamp: Date;
}

/**
 * WhisperAnalytics
 * Central analytics service for tracking Whisper usage
 */
export class WhisperAnalytics {
  private static instance: WhisperAnalytics;
  private sessionId: string;
  private userId?: string;
  private eventQueue: AnalyticsEvent[] = [];
  private errorQueue: ErrorLog[] = [];
  private metricsQueue: PerformanceMetric[] = [];
  private flushInterval: number = 30000; // 30 seconds
  private flushTimer?: NodeJS.Timeout;
  private analyticsEndpoint = '/api/analytics/whisper';
  private isEnabled = true;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.startFlushTimer();
    this.setupErrorHandlers();
    this.setupPerformanceObserver();
  }

  static getInstance(): WhisperAnalytics {
    if (!WhisperAnalytics.instance) {
      WhisperAnalytics.instance = new WhisperAnalytics();
    }
    return WhisperAnalytics.instance;
  }

  /**
   * Set user ID for tracking
   */
  setUserId(userId: string): void {
    this.userId = userId;
  }

  /**
   * Enable or disable analytics
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      this.clearQueues();
    }
  }

  /**
   * Track an event
   */
  track(event: string, properties?: Record<string, any>): void {
    if (!this.isEnabled) return;

    this.eventQueue.push({
      event,
      properties,
      timestamp: new Date(),
      sessionId: this.sessionId,
      userId: this.userId,
    });

    // Flush if queue is getting large
    if (this.eventQueue.length >= 50) {
      this.flush();
    }
  }

  /**
   * Track a performance metric
   */
  trackMetric(name: string, value: number, unit: string, tags?: Record<string, string>): void {
    if (!this.isEnabled) return;

    this.metricsQueue.push({
      name,
      value,
      unit,
      tags,
      timestamp: new Date(),
    });
  }

  /**
   * Log an error
   */
  logError(error: Error, context: Record<string, any>, severity: ErrorLog['severity'] = 'medium'): void {
    if (!this.isEnabled) return;

    const errorLog: ErrorLog = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } as any,
      context,
      timestamp: new Date(),
      sessionId: this.sessionId,
      userId: this.userId,
      severity,
    };

    this.errorQueue.push(errorLog);

    // Immediately flush critical errors
    if (severity === 'critical') {
      this.flush();
    }

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[WhisperAnalytics]', error, context);
    }
  }

  /**
   * Track Whisper-specific events
   */
  trackWhisperEvent(type: 'model_download' | 'transcription' | 'initialization' | 'error', data: any): void {
    switch (type) {
      case 'model_download':
        this.track('whisper_model_download', {
          model: data.model,
          size: data.size,
          duration: data.duration,
          success: data.success,
          source: data.source,
        });
        break;

      case 'transcription':
        this.track('whisper_transcription', {
          method: data.method,
          model: data.model,
          audioLength: data.audioLength,
          processingTime: data.processingTime,
          segmentCount: data.segmentCount,
          language: data.language,
          success: data.success,
          fallbackUsed: data.fallbackUsed,
        });

        // Track performance metrics
        if (data.processingTime && data.audioLength) {
          const rtf = data.processingTime / (data.audioLength * 1000); // Real-time factor
          this.trackMetric('whisper_rtf', rtf, 'ratio', {
            model: data.model,
            method: data.method,
          });
        }
        break;

      case 'initialization':
        this.track('whisper_initialization', {
          model: data.model,
          duration: data.duration,
          success: data.success,
          cached: data.cached,
        });
        break;

      case 'error':
        this.logError(data.error, {
          operation: data.operation,
          model: data.model,
          method: data.method,
          ...data.context,
        }, data.severity || 'medium');
        break;
    }
  }

  /**
   * Get analytics summary
   */
  getSummary(): {
    totalEvents: number;
    totalErrors: number;
    sessionDuration: number;
    modelUsage: Record<string, number>;
    errorRate: number;
  } {
    const now = Date.now();
    const sessionStart = parseInt(this.sessionId.split('-')[0]);
    const sessionDuration = now - sessionStart;

    // Count model usage
    const modelUsage: Record<string, number> = {};
    this.eventQueue
      .filter(e => e.event === 'whisper_transcription')
      .forEach(e => {
        const model = e.properties?.model || 'unknown';
        modelUsage[model] = (modelUsage[model] || 0) + 1;
      });

    const totalTranscriptions = this.eventQueue.filter(e => e.event === 'whisper_transcription').length;
    const failedTranscriptions = this.eventQueue.filter(
      e => e.event === 'whisper_transcription' && !e.properties?.success
    ).length;

    return {
      totalEvents: this.eventQueue.length,
      totalErrors: this.errorQueue.length,
      sessionDuration,
      modelUsage,
      errorRate: totalTranscriptions > 0 ? failedTranscriptions / totalTranscriptions : 0,
    };
  }

  /**
   * Flush queued data to server
   */
  private async flush(): Promise<void> {
    if (!this.isEnabled) return;

    const events = [...this.eventQueue];
    const errors = [...this.errorQueue];
    const metrics = [...this.metricsQueue];

    if (events.length === 0 && errors.length === 0 && metrics.length === 0) {
      return;
    }

    // Clear queues
    this.eventQueue = [];
    this.errorQueue = [];
    this.metricsQueue = [];

    try {
      await fetch(this.analyticsEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({
          events,
          errors,
          metrics,
          sessionId: this.sessionId,
          userId: this.userId,
        }),
      });
    } catch (error) {
      // Re-add to queues on failure
      this.eventQueue.push(...events);
      this.errorQueue.push(...errors);
      this.metricsQueue.push(...metrics);
      
      console.error('[WhisperAnalytics] Failed to flush data:', error);
    }
  }

  /**
   * Setup automatic flushing
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);

    // Flush on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.flush();
      });
    }
  }

  /**
   * Setup global error handlers
   */
  private setupErrorHandlers(): void {
    if (typeof window !== 'undefined') {
      // Catch unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        if (event.reason?.message?.includes('whisper') || 
            event.reason?.message?.includes('Whisper')) {
          this.logError(
            new Error(event.reason.message || 'Unhandled Whisper promise rejection'),
            {
              type: 'unhandledrejection',
              promise: event.promise,
            },
            'high'
          );
        }
      });

      // Catch WASM errors through error event listener
      window.addEventListener('error', (event) => {
        if (event.message?.includes('WebAssembly') || event.message?.includes('wasm')) {
          WhisperAnalytics.getInstance().logError(
            new Error(event.message),
            { type: 'wasm_error', url: event.filename },
            'high'
          );
        }
      });
    }
  }

  /**
   * Setup performance observer
   */
  private setupPerformanceObserver(): void {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      try {
        // Observe long tasks
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) { // Tasks longer than 50ms
              this.trackMetric('whisper_long_task', entry.duration, 'ms', {
                name: entry.name,
              });
            }
          }
        });
        
        longTaskObserver.observe({ entryTypes: ['longtask'] });

        // Observe memory usage
        if ((performance as any).memory) {
          setInterval(() => {
            const memory = (performance as any).memory;
            this.trackMetric('whisper_memory_used', memory.usedJSHeapSize, 'bytes');
            this.trackMetric('whisper_memory_total', memory.totalJSHeapSize, 'bytes');
          }, 60000); // Every minute
        }
      } catch (error) {
        console.warn('[WhisperAnalytics] Failed to setup performance observer:', error);
      }
    }
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Clear all queues
   */
  private clearQueues(): void {
    this.eventQueue = [];
    this.errorQueue = [];
    this.metricsQueue = [];
  }

  /**
   * Destroy the analytics instance
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush();
    this.clearQueues();
  }
}

/**
 * Helper function to track Whisper events
 */
export function trackWhisperEvent(
  type: Parameters<WhisperAnalytics['trackWhisperEvent']>[0],
  data: Parameters<WhisperAnalytics['trackWhisperEvent']>[1]
): void {
  WhisperAnalytics.getInstance().trackWhisperEvent(type, data);
}

/**
 * Helper function to log Whisper errors
 */
export function logWhisperError(
  error: Error,
  context: Record<string, any>,
  severity?: ErrorLog['severity']
): void {
  WhisperAnalytics.getInstance().logError(error, context, severity);
}