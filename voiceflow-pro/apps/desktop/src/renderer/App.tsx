import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import VoiceFlowProMinimal from './pages/VoiceFlowProMinimal';

const queryClient = new QueryClient();

export default function App() {
  const handleUrlSubmit = async (url: string) => {
    try {
      const electronAPI = window.electronAPI;
      if (!electronAPI) {
        console.error('Electron API not available');
        return;
      }

      console.log('Validating URL:', url);
      const validation = await electronAPI.urlIngest.validate(url);
      
      if (!validation.valid) {
        console.error('Invalid URL:', validation.error);
        return;
      }

      console.log('Processing URL:', url);
      const result = await electronAPI.urlIngest.process(url);
      
      if (result.success) {
        console.log('URL processed successfully');
      } else {
        console.error('Failed to process URL:', result.error);
      }
    } catch (error) {
      console.error('Error processing URL:', error);
    }
  };

  const handleQuickAction = async (action: string) => {
    try {
      const electronAPI = window.electronAPI;
      if (!electronAPI) {
        console.error('Electron API not available');
        return;
      }

      switch (action) {
        case 'upload':
          console.log('Opening file dialog...');
          const result = await electronAPI.fileImport.openDialog();
          if (result.success && result.filePaths) {
            console.log('Selected files:', result.filePaths);
          } else if (result.error) {
            console.error('File dialog error:', result.error);
          }
          break;
        case 'record':
          console.log('Recording feature not yet implemented');
          break;
        case 'import-folder':
          console.log('Folder import feature not yet implemented');
          break;
        default:
          console.log('Unknown action:', action);
      }
    } catch (error) {
      console.error('Error handling quick action:', error);
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <VoiceFlowProMinimal 
        onUrlSubmit={handleUrlSubmit}
        onQuickAction={handleQuickAction}
      />
    </QueryClientProvider>
  );
}