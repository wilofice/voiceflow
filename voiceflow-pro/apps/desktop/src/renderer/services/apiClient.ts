import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import { EventEmitter } from 'eventemitter3';
import pRetry from 'p-retry';
import { io, Socket } from 'socket.io-client';
import { z } from 'zod';

import {
  User,
  AuthTokens,
  LoginRequest,
  RegisterRequest,
  LoginResponse,
  RegisterResponse,
  Transcript,
  CreateTranscriptRequest,
  UpdateTranscriptRequest,
  UploadMetadata,
  UploadResponse,
  PaginatedResponse,
  APIError,
  ProgressCallback,
  RequestConfig,
  ModelInfo,
  WebSocketMessage
} from '../types/api';

// Response schemas for validation
const loginResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    subscriptionTier: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  }),
  tokens: z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
    expiresAt: z.number(),
  }).optional(),
}).transform((data) => {
  // Ensure tokens exist or throw meaningful error
  if (!data.tokens) {
    throw new Error('Login response missing authentication tokens');
  }
  return {
    user: {
      ...data.user,
      createdAt: data.user.createdAt || new Date().toISOString(),
      updatedAt: data.user.updatedAt || new Date().toISOString(),
    },
    tokens: data.tokens,
  };
});

const registerResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    subscriptionTier: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  }).optional(),
  tokens: z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
    expiresAt: z.number(),
  }).optional(),
  requiresConfirmation: z.boolean().optional(),
  message: z.string().optional(),
}).transform((data) => {
  // Add default timestamps if user is provided but missing them
  if (data.user && (!data.user.createdAt || !data.user.updatedAt)) {
    const now = new Date().toISOString();
    return {
      ...data,
      user: {
        ...data.user,
        createdAt: data.user.createdAt || now,
        updatedAt: data.user.updatedAt || now,
      },
    };
  }
  return data;
});

export class APIClient extends EventEmitter {
  private client: AxiosInstance;
  private socket: Socket | null = null;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private isRefreshing: boolean = false;
  private refreshPromise: Promise<void> | null = null;

  private readonly baseURL: string;
  private readonly retryConfig = {
    retries: 3,
    factor: 2,
    minTimeout: 1000,
    maxTimeout: 10000,
  };

  constructor(baseURL: string = 'http://localhost:3002') {
    super();
    this.baseURL = baseURL;
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
    this.loadStoredTokens();
    this.initializeWebSocket();
  }

  private setupInterceptors() {
    // Request interceptor for auth
    this.client.interceptors.request.use(
      async (config) => {
        // Add auth token if available and not expired
        if (this.accessToken && this.tokenExpiresAt > Date.now() + 60000) { // 1 min buffer
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        } else if (this.refreshToken && !this.isRefreshing) {
          // Token expired, refresh it
          await this.refreshTokens();
          if (this.accessToken) {
            config.headers.Authorization = `Bearer ${this.accessToken}`;
          }
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
        
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            await this.refreshTokens();
            if (this.accessToken) {
              originalRequest.headers = {
                ...originalRequest.headers,
                Authorization: `Bearer ${this.accessToken}`,
              };
              return this.client(originalRequest);
            }
          } catch (refreshError) {
            this.clearTokens();
            this.emit('auth:expired');
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(this.normalizeError(error));
      }
    );
  }

  private async loadStoredTokens(): Promise<void> {
    try {
      // Try to load tokens from secure storage via IPC
      if (typeof window !== 'undefined' && (window as any).electronAPI?.secureStore) {
        const tokens = await (window as any).electronAPI.secureStore.get('auth_tokens');
        if (tokens) {
          const parsed = JSON.parse(tokens);
          this.setTokens(parsed);
        }
      }
    } catch (error) {
      console.warn('Failed to load stored tokens:', error);
    }
  }

  private async storeTokens(tokens: AuthTokens): Promise<void> {
    try {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.secureStore) {
        await (window as any).electronAPI.secureStore.set('auth_tokens', JSON.stringify(tokens));
      }
    } catch (error) {
      console.warn('Failed to store tokens:', error);
    }
  }

  private setTokens(tokens: AuthTokens): void {
    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;
    this.tokenExpiresAt = tokens.expiresAt;
  }

  private clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiresAt = 0;
    
    // Clear stored tokens
    if (typeof window !== 'undefined' && (window as any).electronAPI?.secureStore) {
      (window as any).electronAPI.secureStore.delete('auth_tokens').catch(console.warn);
    }
  }

  private async refreshTokens(): Promise<void> {
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    this.isRefreshing = true;
    this.refreshPromise = this.performTokenRefresh();
    
    try {
      await this.refreshPromise;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  private async performTokenRefresh(): Promise<void> {
    try {
      const response = await axios.post(`${this.baseURL}/api/auth/refresh`, {
        refreshToken: this.refreshToken,
      });

      const tokens = response.data.tokens;
      this.setTokens(tokens);
      await this.storeTokens(tokens);
      this.connectWebSocket();
      
      this.emit('auth:refreshed');
    } catch (error) {
      this.clearTokens();
      throw error;
    }
  }

  private normalizeError(error: AxiosError): APIError {
    if (error.response?.data) {
      const errorData = error.response.data as any;
      return {
        code: errorData.error?.code || 'UNKNOWN_ERROR',
        message: errorData.error?.message || error.message,
        details: errorData.error?.details,
      };
    }

    return {
      code: error.code || 'NETWORK_ERROR',
      message: error.message,
    };
  }

  private async retryableRequest<T>(
    operation: () => Promise<T>,
    config?: RequestConfig
  ): Promise<T> {
    return pRetry(operation, {
      ...this.retryConfig,
      ...config,
      onFailedAttempt: (error) => {
        console.warn(`API request failed (attempt ${error.attemptNumber}):`, error.cause?.message || 'Unknown error');
      },
    });
  }

  // ===== AUTHENTICATION METHODS =====

  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await this.retryableRequest(async () => {
      return this.client.post('/api/auth/login', { email, password });
    });

    const validated = loginResponseSchema.parse(response.data);
    
    this.setTokens(validated.tokens);
    await this.storeTokens(validated.tokens);
    this.connectWebSocket();
    
    this.emit('auth:login', validated.user);
    return validated;
  }

  async register(email: string, password: string, name: string): Promise<RegisterResponse> {
    const response = await this.retryableRequest(async () => {
      return this.client.post('/api/auth/register', { email, password, name });
    });

    const validated = registerResponseSchema.parse(response.data);
    
    // Only set tokens and connect if the user doesn't require confirmation
    if (validated.tokens && validated.user && !validated.requiresConfirmation) {
      this.setTokens(validated.tokens);
      await this.storeTokens(validated.tokens);
      this.connectWebSocket();
      this.emit('auth:register', validated.user);
    } else if (validated.requiresConfirmation) {
      this.emit('auth:confirmation_required', { email, message: validated.message });
    }
    
    return validated;
  }

  async logout(): Promise<void> {
    try {
      if (this.refreshToken) {
        await this.retryableRequest(async () => {
          return this.client.post('/api/auth/logout', {
            refreshToken: this.refreshToken,
          });
        });
      }
    } catch (error) {
      console.warn('Logout API call failed:', error);
    } finally {
      this.disconnectWebSocket();
      this.clearTokens();
      this.emit('auth:logout');
    }
  }

  // ===== TRANSCRIPT METHODS =====

  async getTranscripts(
    page: number = 1,
    limit: number = 20,
    status?: string
  ): Promise<PaginatedResponse<Transcript>> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(status && { status }),
    });

    const response = await this.retryableRequest(async () => {
      return this.client.get(`/api/transcripts?${params}`);
    });

    return response.data;
  }

  async getTranscript(id: string): Promise<Transcript> {
    const response = await this.retryableRequest(async () => {
      return this.client.get(`/api/transcripts/${id}`);
    });

    return response.data;
  }

  async createTranscript(data: CreateTranscriptRequest): Promise<Transcript> {
    const response = await this.retryableRequest(async () => {
      return this.client.post('/api/transcripts', data);
    });

    const transcript = response.data;
    this.emit('transcript:created', transcript);
    return transcript;
  }

  async updateTranscript(id: string, data: UpdateTranscriptRequest): Promise<Transcript> {
    const response = await this.retryableRequest(async () => {
      return this.client.put(`/api/transcripts/${id}`, data);
    });

    const transcript = response.data;
    this.emit('transcript:updated', transcript);
    return transcript;
  }

  async deleteTranscript(id: string): Promise<void> {
    await this.retryableRequest(async () => {
      return this.client.delete(`/api/transcripts/${id}`);
    });

    this.emit('transcript:deleted', id);
  }

  // ===== UPLOAD METHODS =====

  async uploadFile(
    file: File,
    metadata: UploadMetadata = {},
    onProgress?: ProgressCallback
  ): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (metadata.title) formData.append('title', metadata.title);
    if (metadata.language) formData.append('language', metadata.language);

    const response = await this.client.post('/api/upload/audio', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = (progressEvent.loaded / progressEvent.total) * 100;
          onProgress(progress, progressEvent.loaded, progressEvent.total);
        }
      },
    });

    const upload = response.data;
    this.emit('upload:completed', upload);
    return upload;
  }

  // ===== MODEL METHODS =====

  async getAvailableModels(): Promise<ModelInfo[]> {
    const response = await this.retryableRequest(async () => {
      return this.client.get('/api/models');
    });

    return response.data;
  }

  // ===== USER METHODS =====

  async getUserProfile(): Promise<User> {
    const response = await this.retryableRequest(async () => {
      return this.client.get('/api/users/profile');
    });

    return response.data;
  }

  // ===== UTILITY METHODS =====

  isAuthenticated(): boolean {
    return !!this.accessToken && this.tokenExpiresAt > Date.now();
  }

  getAuthToken(): string | null {
    return this.accessToken;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/health');
      return true;
    } catch {
      return false;
    }
  }

  // ===== WEBSOCKET METHODS =====

  private initializeWebSocket(): void {
    try {
      this.socket = io(this.baseURL, {
        autoConnect: false,
        transports: ['websocket', 'polling'],
        timeout: 5000,
        reconnection: false, // Disable automatic reconnection to prevent spam
      });

      this.socket.on('connect', () => {
        console.log('WebSocket connected');
        this.emit('ws:connected');
      });

      this.socket.on('disconnect', () => {
        console.log('WebSocket disconnected');
        this.emit('ws:disconnected');
      });

      this.socket.on('connect_error', (error) => {
        console.warn('WebSocket connection failed (this is optional):', error.message);
        this.emit('ws:error', error);
        // Don't throw - WebSocket is optional
      });

      this.socket.on('transcript_progress', (data: any) => {
        this.emit('transcript:progress', data);
      });

      this.socket.on('transcript_completed', (data: any) => {
        this.emit('transcript:completed', data);
      });

      this.socket.on('transcript_error', (data: any) => {
        this.emit('transcript:error', data);
      });
    } catch (error) {
      console.warn('Failed to initialize WebSocket (continuing without real-time features):', error);
      this.socket = null;
    }
  }

  private connectWebSocket(): void {
    if (this.socket && !this.socket.connected && this.accessToken) {
      try {
        this.socket.auth = { token: this.accessToken };
        this.socket.connect();
      } catch (error) {
        console.warn('Failed to connect WebSocket (continuing without real-time features):', error);
      }
    }
  }

  private disconnectWebSocket(): void {
    if (this.socket && this.socket.connected) {
      this.socket.disconnect();
    }
  }

  subscribeToTranscript(transcriptId: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('subscribe', { transcriptId });
    }
  }

  unsubscribeFromTranscript(transcriptId: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('unsubscribe', { transcriptId });
    }
  }
}

// Singleton instance
export const apiClient = new APIClient();