import React, { useState, useEffect } from 'react';

import { initializeStores } from '../../stores';
import { useAuthStore } from '../../stores/authStore';

import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

export function AuthContainer() {
  const [isLogin, setIsLogin] = useState(true);
  const { isAuthenticated, initializeAuth } = useAuthStore();

  useEffect(() => {
    // Initialize stores and auth on component mount
    const init = async () => {
      await initializeStores();
      await initializeAuth();
    };
    
    init();
  }, [initializeAuth]);

  const toggleMode = () => {
    setIsLogin(!isLogin);
  };

  // If authenticated, this component shouldn't render
  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            VoiceFlow Pro
          </h1>
          <p className="text-gray-600">
            Professional audio transcription and analysis
          </p>
        </div>
        
        {isLogin ? (
          <LoginForm onToggleMode={toggleMode} />
        ) : (
          <RegisterForm onToggleMode={toggleMode} />
        )}
      </div>
    </div>
  );
}