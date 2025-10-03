import { Loader2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { useAuthStore } from '../../stores/authStore';

import { AuthContainer } from './AuthContainer';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, initializeAuth } = useAuthStore();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        await initializeAuth();
      } catch (error) {
        console.error('Failed to initialize auth:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    init();
  }, [initializeAuth]);

  // Show loading spinner while initializing authentication
  if (isInitializing || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading VoiceFlow Pro...</p>
        </div>
      </div>
    );
  }

  // Show authentication forms if not authenticated
  if (!isAuthenticated) {
    return <AuthContainer />;
  }

  // Render protected content if authenticated
  return <>{children}</>;
}