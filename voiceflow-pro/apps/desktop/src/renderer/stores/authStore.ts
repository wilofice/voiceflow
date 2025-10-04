import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { apiClient } from '../services/apiClient';
import { User, LoginResponse } from '../types/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  initializeAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response: LoginResponse = await apiClient.login(email, password);
          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error: any) {
          const errorMessage = error?.response?.data?.message || 
                               error?.message || 
                               (error instanceof Error ? error.message : 'Login failed');
          set({
            isLoading: false,
            error: errorMessage,
            isAuthenticated: false,
            user: null,
          });
          throw new Error(errorMessage);
        }
      },

      register: async (email: string, password: string, name: string) => {
        set({ isLoading: true, error: null });
        try {
          const response: LoginResponse = await apiClient.register(email, password, name);
          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error: any) {
          const errorMessage = error?.response?.data?.message || 
                               error?.message || 
                               (error instanceof Error ? error.message : 'Registration failed');
          set({
            isLoading: false,
            error: errorMessage,
            isAuthenticated: false,
            user: null,
          });
          throw new Error(errorMessage);
        }
      },

      logout: async () => {
        set({ isLoading: true });
        try {
          await apiClient.logout();
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        } catch (error: any) {
          console.warn('Logout error:', error);
          // Force logout even if API call fails
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      },

      clearError: () => {
        set({ error: null });
      },

      initializeAuth: async () => {
        const isAuthenticated = apiClient.isAuthenticated();
        if (isAuthenticated) {
          try {
            const user = await apiClient.getUserProfile();
            set({
              user,
              isAuthenticated: true,
              error: null,
            });
          } catch (error) {
            // Token might be invalid, clear auth state
            set({
              user: null,
              isAuthenticated: false,
              error: null,
            });
          }
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Set up API client event listeners
apiClient.on('auth:login', (user: User) => {
  useAuthStore.getState().initializeAuth();
});

apiClient.on('auth:logout', () => {
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    error: null,
  });
});

apiClient.on('auth:expired', () => {
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    error: 'Session expired. Please log in again.',
  });
});