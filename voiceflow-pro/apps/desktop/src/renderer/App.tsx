import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from './components/ui/tooltip';
import { Toaster } from './components/ui/sonner';
import { Toaster as RadixToaster } from './components/ui/toaster';
import { VoiceFlowPro } from './pages/VoiceFlowPro';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <RadixToaster />
        <VoiceFlowPro />
      </TooltipProvider>
    </QueryClientProvider>
  );
}