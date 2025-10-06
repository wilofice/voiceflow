import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { ProtectedRoute } from './components/auth';
import { Toaster } from './components/ui/sonner';
import { Toaster as RadixToaster } from './components/ui/toaster';
import { TooltipProvider } from './components/ui/tooltip';
import { VoiceFlowPro } from './pages/VoiceFlowPro';
import NotFound from './pages/NotFound';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <RadixToaster />
        <ProtectedRoute>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<VoiceFlowPro />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ProtectedRoute>
      </TooltipProvider>
    </QueryClientProvider>
  );
}