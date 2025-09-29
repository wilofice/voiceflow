// Export all stores for easy importing
export { useAuthStore } from './authStore';
export { useTranscriptStore } from './transcriptStore';
export { useUploadStore } from './uploadStore';
export { useModelsStore } from './modelsStore';

// Store initialization function
export const initializeStores = async () => {
  const { useAuthStore } = await import('./authStore');
  
  // Initialize auth on app startup
  try {
    await useAuthStore.getState().initializeAuth();
  } catch (error) {
    console.warn('Failed to initialize auth:', error);
  }
};