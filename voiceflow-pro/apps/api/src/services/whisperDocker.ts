/**
 * Whisper Docker Service
 * Handles whisper.cpp processing via Docker containers
 */

import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

export interface WhisperDockerOptions {
  model?: WhisperModel;
  language?: string;
  task?: 'transcribe' | 'translate';
  threads?: number;
  outputFormat?: 'txt' | 'vtt' | 'srt' | 'json';
  wordTimestamps?: boolean;
  temperature?: number;
  maxTokens?: number;
  containerName?: string;
  timeout?: number;
}

export type WhisperModel = 'tiny' | 'tiny.en' | 'base' | 'base.en' | 'small' | 'small.en' | 'medium' | 'medium.en';

export interface TranscriptionResult {
  text: string;
  segments?: TranscriptionSegment[];
  language?: string;
  duration?: number;
  processingTime: number;
  model: string;
  method: 'whisper-server-docker';
  containerId?: string;
}

export interface TranscriptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  confidence?: number;
}

export interface DockerContainerInfo {
  id: string;
  name: string;
  status: string;
  created: string;
  ports: string[];
  image: string;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'starting';
  dockerAvailable: boolean;
  containerRunning: boolean;
  containerInfo?: DockerContainerInfo;
  availableModels: string[];
  systemInfo: {
    dockerVersion?: string;
    containerRuntime?: string;
  };
  uptime: number;
}

export interface ProcessingJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  startTime: number;
  endTime?: number;
  error?: string;
  result?: TranscriptionResult;
  containerId?: string;
}

export class WhisperDockerService {
  private config: WhisperDockerConfig;
  private processingJobs = new Map<string, ProcessingJob>();
  private healthStatus: HealthStatus;
  private startTime: number;
  private containerUrl: string;

  constructor(config?: Partial<WhisperDockerConfig>) {
    this.startTime = Date.now();
    
    this.config = {
      containerImage: config?.containerImage || 'voiceflow/whisper:latest',
      containerName: config?.containerName || 'voiceflow-whisper',
      containerPort: config?.containerPort || 8080,
      hostPort: config?.hostPort || 8080,
      defaultModel: config?.defaultModel || 'base',
      maxConcurrentJobs: config?.maxConcurrentJobs || 3,
      timeout: config?.timeout || 600000, // 10 minutes
      autoStart: config?.autoStart !== false,
      volumePath: config?.volumePath || path.join(os.tmpdir(), 'whisper-docker'),
      ...config
    };

    this.containerUrl = `http://localhost:${this.config.hostPort}`;
    this.initializeService();
  }

  /**
   * Initialize the Docker service
   */
  private async initializeService(): Promise<void> {
    console.log('🐳 Initializing Whisper Docker Service...');
    
    try {
      // Create volume directory
      await fs.mkdir(this.config.volumePath, { recursive: true });
      
      // Check Docker availability
      await this.checkDockerAvailability();
      
      // Start container if needed
      if (this.config.autoStart) {
        await this.ensureContainerRunning();
      }
      
      // Update health status
      await this.updateHealthStatus();
      
      console.log(`✅ Whisper Docker Service initialized successfully`);
      console.log(`🐳 Container: ${this.config.containerName}`);
      console.log(`📍 URL: ${this.containerUrl}`);
      
    } catch (error) {
      console.error('❌ Failed to initialize Whisper Docker Service:', error);
      //throw error;
    }
  }

  /**
   * Transcribe an audio file using Docker whisper container
   */
  async transcribeFile(
    filePath: string, 
    options: WhisperDockerOptions = {}
  ): Promise<TranscriptionResult> {
    const jobId = uuidv4();
    const startTime = Date.now();

    // Create processing job
    const job: ProcessingJob = {
      id: jobId,
      status: 'queued',
      progress: 0,
      startTime,
    };
    this.processingJobs.set(jobId, job);

    try {
      // Ensure container is running
      await this.ensureContainerRunning();
      
      // Check if file exists
      await fs.access(filePath);
      
      // Update job status
      job.status = 'processing';
      job.progress = 10;

      // Copy file to shared volume
      const containerFilePath = await this.copyFileToContainer(filePath);
      job.progress = 20;

      // Prepare transcription request
      const requestData = {
        file: containerFilePath,
        model: options.model || this.config.defaultModel,
        language: options.language,
        task: options.task || 'transcribe',
        word_timestamps: options.wordTimestamps || false,
        output_format: 'json'
      };

      // Execute transcription via HTTP API
      const result = await this.executeTranscriptionRequest(requestData, jobId);
      
      // Process results
      const processingTime = Date.now() - startTime;
      const transcriptionResult: TranscriptionResult = {
        text: result.text,
        segments: result.segments,
        language: result.language,
        duration: result.duration,
        processingTime,
        model: options.model || this.config.defaultModel,
        method: 'whisper-server-docker',
        containerId: await this.getContainerId()
      };

      // Update job
      job.status = 'completed';
      job.progress = 100;
      job.endTime = Date.now();
      job.result = transcriptionResult;

      // Clean up temporary file
      await this.cleanupFile(containerFilePath);

      return transcriptionResult;

    } catch (error: any) {
      // Update job with error
      job.status = 'failed';
      job.endTime = Date.now();
      job.error = error.message;

      console.error(`❌ Docker transcription failed for job ${jobId}:`, error);
      throw new Error(`Whisper Docker transcription failed: ${error.message}`);
      
    } finally {
      // Clean up job after some time
      setTimeout(() => {
        this.processingJobs.delete(jobId);
      }, 5 * 60 * 1000); // Keep job info for 5 minutes
    }
  }

  /**
   * Get current health status
   */
  async getHealthStatus(): Promise<HealthStatus> {
    await this.updateHealthStatus();
    return this.healthStatus;
  }

  /**
   * Start the whisper container
   */
  async startContainer(): Promise<void> {
    console.log('🚀 Starting Whisper container...');
    
    try {
      // Check if container already exists
      const existing = await this.getContainerInfo();
      
      if (existing && existing.status.includes('running')) {
        console.log('✅ Container already running');
        return;
      }

      if (existing && !existing.status.includes('running')) {
        // Start existing container
        await this.execDockerCommand(['start', this.config.containerName]);
      } else {
        // Create and run new container
        await this.createAndRunContainer();
      }

      // Wait for container to be ready
      await this.waitForContainerReady();
      
      console.log('✅ Whisper container started successfully');
      
    } catch (error) {
      console.error('❌ Failed to start container:', error);
      throw error;
    }
  }

  /**
   * Stop the whisper container
   */
  async stopContainer(): Promise<void> {
    console.log('🛑 Stopping Whisper container...');
    
    try {
      await this.execDockerCommand(['stop', this.config.containerName]);
      console.log('✅ Container stopped successfully');
    } catch (error) {
      console.error('❌ Failed to stop container:', error);
      throw error;
    }
  }

  /**
   * Remove the whisper container
   */
  async removeContainer(): Promise<void> {
    console.log('🗑️  Removing Whisper container...');
    
    try {
      // Stop first if running
      try {
        await this.stopContainer();
      } catch {
        // Container might not be running
      }
      
      await this.execDockerCommand(['rm', this.config.containerName]);
      console.log('✅ Container removed successfully');
    } catch (error) {
      console.error('❌ Failed to remove container:', error);
      throw error;
    }
  }

  /**
   * Get processing job status
   */
  getJobStatus(jobId: string): ProcessingJob | null {
    return this.processingJobs.get(jobId) || null;
  }

  /**
   * Get all active jobs
   */
  getActiveJobs(): ProcessingJob[] {
    return Array.from(this.processingJobs.values());
  }

  /**
   * Check Docker availability
   */
  private async checkDockerAvailability(): Promise<void> {
    try {
      await this.execDockerCommand(['--version']);
      console.log('✅ Docker is available');
    } catch (error) {
      throw new Error('Docker is not available. Please install Docker first.');
    }
  }

  /**
   * Ensure container is running
   */
  private async ensureContainerRunning(): Promise<void> {
    const info = await this.getContainerInfo();
    
    if (!info || !info.status.includes('running')) {
      await this.startContainer();
    }
  }

  /**
   * Create and run the whisper container
   */
  private async createAndRunContainer(): Promise<void> {
    const command = [
      'run',
      '-d', // Detached
      '--name', this.config.containerName,
      '-p', `${this.config.hostPort}:${this.config.containerPort}`,
      '-v', `${this.config.volumePath}:/opt/whisper/temp`,
      '--restart', 'unless-stopped',
      '-e', `WHISPER_MODEL=${this.config.defaultModel}`,
      '-e', `WHISPER_PORT=${this.config.containerPort}`,
      this.config.containerImage
    ];

    await this.execDockerCommand(command);
  }

  /**
   * Wait for container to be ready
   */
  private async waitForContainerReady(): Promise<void> {
    const maxAttempts = 30;
    const delay = 2000; // 2 seconds

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await axios.get(`${this.containerUrl}/health`, {
          timeout: 5000
        });
        
        if (response.status === 200) {
          console.log('✅ Container is ready');
          return;
        }
      } catch (error) {
        console.log(`⏳ Waiting for container... (attempt ${attempt}/${maxAttempts})`);
      }

      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Container failed to become ready within timeout period');
  }

  /**
   * Get container information
   */
  private async getContainerInfo(): Promise<DockerContainerInfo | null> {
    try {
      const output = await this.execDockerCommand([
        'ps', '-a',
        '--filter', `name=${this.config.containerName}`,
        '--format', 'table {{.ID}}|{{.Names}}|{{.Status}}|{{.CreatedAt}}|{{.Ports}}|{{.Image}}'
      ]);

      const lines = output.split('\n').filter(line => line.trim());
      if (lines.length < 2) return null; // No container found

      const [id, name, status, created, ports, image] = lines[1].split('|');
      
      return {
        id: id.trim(),
        name: name.trim(),
        status: status.trim(),
        created: created.trim(),
        ports: ports.trim().split(',').map(p => p.trim()),
        image: image.trim()
      };
    } catch {
      return null;
    }
  }

  /**
   * Get container ID
   */
  private async getContainerId(): Promise<string | undefined> {
    const info = await this.getContainerInfo();
    return info?.id;
  }

  /**
   * Copy file to container shared volume
   */
  private async copyFileToContainer(filePath: string): Promise<string> {
    const fileName = `${uuidv4()}-${path.basename(filePath)}`;
    const containerPath = path.join(this.config.volumePath, fileName);
    
    await fs.copyFile(filePath, containerPath);
    
    // Return path relative to container
    return `/opt/whisper/temp/${fileName}`;
  }

  /**
   * Clean up temporary file
   */
  private async cleanupFile(containerFilePath: string): Promise<void> {
    try {
      const fileName = path.basename(containerFilePath);
      const hostPath = path.join(this.config.volumePath, fileName);
      await fs.unlink(hostPath);
    } catch (error) {
      console.warn('Failed to cleanup temporary file:', error);
    }
  }

  /**
   * Execute transcription request via HTTP API
   */
  private async executeTranscriptionRequest(
    requestData: any,
    jobId: string
  ): Promise<TranscriptionResult> {
    const job = this.processingJobs.get(jobId);
    
    try {
      if (job) job.progress = 30;

      const response = await axios.post(`${this.containerUrl}/transcribe`, requestData, {
        timeout: this.config.timeout,
        onUploadProgress: (progressEvent) => {
          if (job && progressEvent.total) {
            const uploadProgress = Math.round((progressEvent.loaded / progressEvent.total) * 30);
            job.progress = Math.max(job.progress, 30 + uploadProgress);
          }
        }
      });

      if (job) job.progress = 80;

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (job) job.progress = 90;

      return response.data;

    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error('Could not connect to Whisper container. Is it running?');
        }
        
        const message = error.response?.data?.error || error.message;
        throw new Error(`Container API error: ${message}`);
      }
      
      throw error;
    }
  }

  /**
   * Execute docker command
   */
  private async execDockerCommand(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      const process = spawn('docker', args);

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`Docker command failed (exit code ${code}): ${stderr}`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Failed to execute docker command: ${error.message}`));
      });
    });
  }

  /**
   * Update health status
   */
  private async updateHealthStatus(): Promise<void> {
    let dockerAvailable = false;
    let dockerVersion = '';
    
    try {
      dockerVersion = await this.execDockerCommand(['--version']);
      dockerAvailable = true;
    } catch {
      // Docker not available
    }

    const containerInfo = await this.getContainerInfo();
    const containerRunning = containerInfo?.status.includes('running') || false;

    // Get available models from container (if running)
    let availableModels: string[] = [];
    if (containerRunning) {
      try {
        const response = await axios.get(`${this.containerUrl}/models`, { timeout: 5000 });
        availableModels = response.data.models || [];
      } catch {
        // Could not get models
      }
    }

    this.healthStatus = {
      status: dockerAvailable && containerRunning ? 'healthy' : 'unhealthy',
      dockerAvailable,
      containerRunning,
      containerInfo,
      availableModels,
      systemInfo: {
        dockerVersion,
        containerRuntime: 'docker'
      },
      uptime: Date.now() - this.startTime
    };
  }
}

interface WhisperDockerConfig {
  containerImage: string;
  containerName: string;
  containerPort: number;
  hostPort: number;
  defaultModel: WhisperModel;
  maxConcurrentJobs: number;
  timeout: number;
  autoStart: boolean;
  volumePath: string;
}