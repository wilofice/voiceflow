import { create } from 'zustand';

import { apiClient } from '../services/apiClient';
import { ModelInfo } from '../types/api';

interface ModelsState {
  models: ModelInfo[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchModels: () => Promise<void>;
  clearError: () => void;
}

export const useModelsStore = create<ModelsState>((set) => ({
  models: [],
  isLoading: false,
  error: null,

  fetchModels: async () => {
    set({ isLoading: true, error: null });
    try {
      const models = await apiClient.getAvailableModels();
      set({
        models,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.message || 'Failed to fetch models',
      });
      throw error;
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));