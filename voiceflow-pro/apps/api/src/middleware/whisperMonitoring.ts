/**
 * Whisper Monitoring Middleware
 * Health checks, performance monitoring, and alerting for Whisper services
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { HybridTranscriptionService } from '../services/hybridTranscription';
import { WhisperServerService } from '../services/whisperServer';
import { WhisperDockerService } from '../services/whisperDocker';
import * as os from 'os';

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
  uptime: number;
  responseTime?: number;
  errorRate?: number;
  lastCheck: Date;
  details?: any;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  disk: {
    usage?: number;
    available?: number;
  };
  processes: {
    whisperLocal?: ProcessInfo;
    whisperDocker?: ProcessInfo;
  };
}

export interface ProcessInfo {
  pid?: number;
  memory: number;
  cpu: number;
  status: string;
  startTime: Date;
}

export interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info';
  service: string;
  message: string;
  timestamp: Date;
  resolved?: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class WhisperMonitoring {
  private static instance: WhisperMonitoring;
  private healthChecks = new Map<string, HealthCheckResult>();
  private systemMetrics: SystemMetrics;
  private alerts: Alert[] = [];
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private startTime = Date.now();

  private constructor() {
    this.systemMetrics = this.getInitialSystemMetrics();
    this.startMonitoring();
  }

  static getInstance(): WhisperMonitoring {
    if (!WhisperMonitoring.instance) {
      WhisperMonitoring.instance = new WhisperMonitoring();
    }
    return WhisperMonitoring.instance;
  }

  /**
   * Start continuous monitoring
   */
  startMonitoring(intervalMs: number = 30000): void {
    if (this.isMonitoring) return;

    console.log('📊 Starting Whisper monitoring...');
    this.isMonitoring = true;

    this.monitoringInterval = setInterval(async () => {
      await this.performHealthChecks();
      this.updateSystemMetrics();
      this.checkAlerts();
    }, intervalMs);

    // Initial check
    setTimeout(() => this.performHealthChecks(), 1000);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    console.log('📊 Stopping Whisper monitoring...');
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Get overall health status
   */
  getOverallHealth(): {
    status: 'healthy' | 'unhealthy' | 'degraded';
    uptime: number;
    services: HealthCheckResult[];
    systemMetrics: SystemMetrics;
    activeAlerts: Alert[];
  } {
    const services = Array.from(this.healthChecks.values());
    
    // Determine overall status
    let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    
    const unhealthyServices = services.filter(s => s.status === 'unhealthy').length;
    const degradedServices = services.filter(s => s.status === 'degraded').length;
    
    if (unhealthyServices > 0 || services.length === 0) {
      status = 'unhealthy';
    } else if (degradedServices > 0) {
      status = 'degraded';
    }

    return {
      status,
      uptime: Date.now() - this.startTime,
      services,
      systemMetrics: this.systemMetrics,
      activeAlerts: this.alerts.filter(a => !a.resolved)
    };
  }

  /**
   * Get specific service health
   */
  getServiceHealth(serviceName: string): HealthCheckResult | null {
    return this.healthChecks.get(serviceName) || null;
  }

  /**
   * Get all alerts
   */
  getAlerts(limit?: number): Alert[] {
    const alerts = [...this.alerts].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return limit ? alerts.slice(0, limit) : alerts;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = new Date();
      return true;
    }
    return false;
  }

  /**
   * Fastify hook for request monitoring (onRequest)
   */
  requestMonitoring() {
    return async (request: FastifyRequest, _reply: FastifyReply) => {
      const startTime = Date.now();
      
      // Store start time on request object
      (request as any).startTime = startTime;
    };
  }

  /**
   * Fastify hook for response monitoring (onResponse)
   */
  responseMonitoring() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const startTime = (request as any).startTime || Date.now();
      const duration = Date.now() - startTime;
      this.trackRequest(request, reply, duration);
    };
  }

  /**
   * Fastify error handler for error monitoring
   */
  errorMonitoring() {
    return (error: any, request: FastifyRequest, reply: FastifyReply) => {
      this.trackError(error, request);
      
      // Send error response
      reply.status(500).send({
        error: error.message || 'Internal server error',
        code: error.code || 'INTERNAL_ERROR',
        timestamp: new Date().toISOString()
      });
    };
  }

  /**
   * Perform health checks on all services
   */
  private async performHealthChecks(): Promise<void> {
    const checks = [
      this.checkHybridService(),
      this.checkLocalWhisperService(),
      this.checkDockerWhisperService(),
      this.checkSystemHealth()
    ];

    await Promise.allSettled(checks);
  }

  /**
   * Check hybrid service health
   */
  private async checkHybridService(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const hybridService = HybridTranscriptionService.getInstance();
      const health = await hybridService.getServiceHealth();
      
      const responseTime = Date.now() - startTime;
      
      // Determine status based on available services
      let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
      
      if (!health.openai.available && !health.whisperLocal.available && !health.whisperDocker.available) {
        status = 'unhealthy';
      } else if (!health.openai.available || !health.whisperLocal.available || !health.whisperDocker.available) {
        status = 'degraded';
      }

      this.healthChecks.set('hybrid', {
        service: 'hybrid',
        status,
        uptime: Date.now() - this.startTime,
        responseTime,
        lastCheck: new Date(),
        details: health
      });

    } catch (error: any) {
      this.healthChecks.set('hybrid', {
        service: 'hybrid',
        status: 'unhealthy',
        uptime: Date.now() - this.startTime,
        lastCheck: new Date(),
        details: { error: error.message }
      });

      this.createAlert('error', 'hybrid', `Hybrid service health check failed: ${error.message}`, 'high');
    }
  }

  /**
   * Check local Whisper service health
   */
  private async checkLocalWhisperService(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // This would need to be injected or accessed differently in a real implementation
      const localService = new WhisperServerService();
      const health = await localService.getHealthStatus();
      
      const responseTime = Date.now() - startTime;
      
      this.healthChecks.set('whisper-local', {
        service: 'whisper-local',
        status: health.status === 'healthy' ? 'healthy' : 'unhealthy',
        uptime: health.uptime,
        responseTime,
        lastCheck: new Date(),
        details: health
      });

      if (health.status !== 'healthy') {
        this.createAlert('warning', 'whisper-local', 'Local Whisper service is not healthy', 'medium');
      }

    } catch (error: any) {
      this.healthChecks.set('whisper-local', {
        service: 'whisper-local',
        status: 'unhealthy',
        uptime: 0,
        lastCheck: new Date(),
        details: { error: error.message }
      });
    }
  }

  /**
   * Check Docker Whisper service health
   */
  private async checkDockerWhisperService(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const dockerService = new WhisperDockerService();
      const health = await dockerService.getHealthStatus();
      
      const responseTime = Date.now() - startTime;
      
      this.healthChecks.set('whisper-docker', {
        service: 'whisper-docker',
        status: health.status === 'healthy' ? 'healthy' : 'unhealthy',
        uptime: health.uptime,
        responseTime,
        lastCheck: new Date(),
        details: health
      });

      if (health.status !== 'healthy') {
        this.createAlert('warning', 'whisper-docker', 'Docker Whisper service is not healthy', 'medium');
      }

    } catch (error: any) {
      this.healthChecks.set('whisper-docker', {
        service: 'whisper-docker',
        status: 'unhealthy',
        uptime: 0,
        lastCheck: new Date(),
        details: { error: error.message }
      });
    }
  }

  /**
   * Check system health
   */
  private async checkSystemHealth(): Promise<void> {
    try {
      this.updateSystemMetrics();
      
      const { cpu, memory } = this.systemMetrics;
      
      let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
      const details: any = {};
      
      // Check CPU usage
      if (cpu.usage > 90) {
        status = 'degraded';
        details.highCpu = true;
        this.createAlert('warning', 'system', `High CPU usage: ${cpu.usage.toFixed(1)}%`, 'medium');
      }
      
      // Check memory usage
      if (memory.usage > 90) {
        status = 'degraded';
        details.highMemory = true;
        this.createAlert('warning', 'system', `High memory usage: ${memory.usage.toFixed(1)}%`, 'medium');
      }
      
      // Check load average
      const loadThreshold = cpu.cores * 0.8;
      if (cpu.loadAverage[0] > loadThreshold) {
        status = 'degraded';
        details.highLoad = true;
      }

      this.healthChecks.set('system', {
        service: 'system',
        status,
        uptime: Date.now() - this.startTime,
        lastCheck: new Date(),
        details
      });

    } catch (error: any) {
      this.healthChecks.set('system', {
        service: 'system',
        status: 'unhealthy',
        uptime: Date.now() - this.startTime,
        lastCheck: new Date(),
        details: { error: error.message }
      });
    }
  }

  /**
   * Update system metrics
   */
  private updateSystemMetrics(): void {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    this.systemMetrics = {
      cpu: {
        usage: this.getCpuUsage(),
        loadAverage: os.loadavg(),
        cores: os.cpus().length
      },
      memory: {
        total: totalMemory,
        used: usedMemory,
        free: freeMemory,
        usage: (usedMemory / totalMemory) * 100
      },
      disk: {
        // Disk metrics would require additional system calls
      },
      processes: {
        // Process metrics would require process monitoring
      }
    };
  }

  /**
   * Get initial system metrics
   */
  private getInitialSystemMetrics(): SystemMetrics {
    return {
      cpu: {
        usage: 0,
        loadAverage: os.loadavg(),
        cores: os.cpus().length
      },
      memory: {
        total: os.totalmem(),
        used: 0,
        free: os.freemem(),
        usage: 0
      },
      disk: {},
      processes: {}
    };
  }

  /**
   * Get CPU usage percentage (simplified)
   */
  private getCpuUsage(): number {
    // This is a simplified CPU usage calculation
    // In a real implementation, you'd want to calculate this over time
    const loadAvg = os.loadavg()[0];
    const cores = os.cpus().length;
    return Math.min((loadAvg / cores) * 100, 100);
  }

  /**
   * Check for alert conditions
   */
  private checkAlerts(): void {
    // Remove old resolved alerts (older than 24 hours)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.alerts = this.alerts.filter(alert => 
      !alert.resolved || alert.resolved.getTime() > oneDayAgo
    );

    // Check for system resource alerts
    const { cpu, memory } = this.systemMetrics;
    
    if (cpu.usage > 95) {
      this.createAlert('error', 'system', `Critical CPU usage: ${cpu.usage.toFixed(1)}%`, 'critical');
    }
    
    if (memory.usage > 95) {
      this.createAlert('error', 'system', `Critical memory usage: ${memory.usage.toFixed(1)}%`, 'critical');
    }
  }

  /**
   * Create an alert
   */
  private createAlert(
    type: 'error' | 'warning' | 'info',
    service: string,
    message: string,
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): void {
    // Check if similar alert already exists and is unresolved
    const existingAlert = this.alerts.find(alert => 
      alert.service === service &&
      alert.message === message &&
      !alert.resolved &&
      Date.now() - alert.timestamp.getTime() < 5 * 60 * 1000 // 5 minutes
    );

    if (existingAlert) {
      return; // Don't create duplicate alerts
    }

    const alert: Alert = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      service,
      message,
      timestamp: new Date(),
      severity
    };

    this.alerts.push(alert);

    // Log alert
    console.log(`🚨 Alert [${severity.toUpperCase()}]: ${service} - ${message}`);

    // Here you could add external alerting (email, Slack, etc.)
    this.sendExternalAlert(alert);
  }

  /**
   * Send external alert (placeholder for integration)
   */
  private sendExternalAlert(alert: Alert): void {
    // Implement external alerting here (email, Slack, webhook, etc.)
    
    if (process.env.WEBHOOK_URL) {
      // Example webhook integration
      const axios = require('axios');
      axios.post(process.env.WEBHOOK_URL, {
        alert,
        timestamp: new Date().toISOString()
      }).catch((error: any) => {
        console.error('Failed to send webhook alert:', error);
      });
    }
  }

  /**
   * Track request metrics
   */
  private trackRequest(request: FastifyRequest, reply: FastifyReply, duration: number): void {
    // Track API request metrics
    const endpoint = request.routerPath || request.url;
    const method = request.method;
    const statusCode = reply.statusCode;

    // Log slow requests
    if (duration > 10000) { // 10 seconds
      this.createAlert('warning', 'api', `Slow request: ${method} ${endpoint} took ${duration}ms`, 'medium');
    }

    // Log error responses
    if (statusCode >= 500) {
      this.createAlert('error', 'api', `Server error: ${method} ${endpoint} returned ${statusCode}`, 'high');
    }
  }

  /**
   * Track error
   */
  private trackError(error: any, request: FastifyRequest): void {
    const endpoint = request.routerPath || request.url;
    const method = request.method;
    
    this.createAlert('error', 'api', `Error in ${method} ${endpoint}: ${error.message}`, 'high');
  }
}

// Export singleton instance
export const whisperMonitoring = WhisperMonitoring.getInstance();