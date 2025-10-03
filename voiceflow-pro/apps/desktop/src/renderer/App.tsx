import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import { ProtectedRoute } from './components/auth';
import { Toaster } from './components/ui/sonner';
import { Toaster as RadixToaster } from './components/ui/toaster';
import { TooltipProvider } from './components/ui/tooltip';
import { VoiceFlowPro } from './pages/VoiceFlowPro';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <RadixToaster />
        <ProtectedRoute>
          <VoiceFlowPro />
        </ProtectedRoute>
      </TooltipProvider>
    </QueryClientProvider>
  );
}