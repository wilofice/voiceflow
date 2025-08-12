"use client";

import React, { Component, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Button } from './button';
import { Alert, AlertDescription } from './alert';
import { Badge } from './badge';
import { Separator } from './separator';
import {
  AlertTriangle,
  RefreshCcw,
  Bug,
  ExternalLink,
  Copy,
  ChevronDown,
  ChevronUp,
  Info,
  X
} from 'lucide-react';

interface ErrorInfo {
  componentStack: string;
  errorBoundary?: string;
  errorBoundaryStack?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  retryCount: number;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  maxRetries?: number;
  showReportButton?: boolean;
  isolateError?: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeout?: NodeJS.Timeout;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      errorInfo,
    });

    // Call the onError prop if provided
    this.props.onError?.(error, errorInfo);

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by ErrorBoundary:', error, errorInfo);
    }

    // In production, you might want to log to an error reporting service
    // logErrorToService(error, errorInfo);
  }

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  handleRetry = () => {
    const { maxRetries = 3 } = this.props;
    const { retryCount } = this.state;

    if (retryCount < maxRetries) {
      this.setState((prevState) => ({
        hasError: false,
        error: null,
        errorInfo: null,
        showDetails: false,
        retryCount: prevState.retryCount + 1,
      }));
    }
  };

  handleAutoRetry = () => {
    // Auto-retry after a delay for transient errors
    this.retryTimeout = setTimeout(() => {
      this.handleRetry();
    }, 2000);
  };

  toggleDetails = () => {
    this.setState((prevState) => ({
      showDetails: !prevState.showDetails,
    }));
  };

  copyErrorDetails = () => {
    const { error, errorInfo } = this.state;
    const errorText = `Error: ${error?.message}\n\nStack: ${error?.stack}\n\nComponent Stack: ${errorInfo?.componentStack}`;
    
    navigator.clipboard.writeText(errorText);
  };

  reportError = () => {
    // Open bug report or feedback form
    const { error, errorInfo } = this.state;
    const subject = encodeURIComponent(`Error Report: ${error?.name || 'Unknown Error'}`);
    const body = encodeURIComponent(`
Error: ${error?.message}

Stack Trace:
${error?.stack}

Component Stack:
${errorInfo?.componentStack}

Browser: ${navigator.userAgent}
URL: ${window.location.href}
Timestamp: ${new Date().toISOString()}
    `);
    
    window.open(`mailto:support@voiceflowpro.com?subject=${subject}&body=${body}`);
  };

  render() {
    const { hasError, error, errorInfo, showDetails, retryCount } = this.state;
    const { children, fallback, maxRetries = 3, showReportButton = true, isolateError = false } = this.props;

    if (hasError) {
      if (fallback) {
        return fallback;
      }

      const canRetry = retryCount < maxRetries;
      const isTransientError = error?.message.includes('network') || 
                              error?.message.includes('timeout') || 
                              error?.message.includes('fetch');

      return (
        <Card className={`w-full max-w-2xl mx-auto ${isolateError ? 'border-red-200' : ''}`}>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              <span>Something went wrong</span>
              <Badge variant="destructive" className="text-xs">
                Error {retryCount > 0 && `(Retry ${retryCount})`}
              </Badge>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Error Message */}
            <Alert variant="destructive">
              <Bug className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">{error?.name || 'Unknown Error'}</p>
                  <p className="text-sm">{error?.message || 'An unexpected error occurred'}</p>
                  
                  {isTransientError && (
                    <p className="text-xs bg-yellow-50 text-yellow-800 p-2 rounded">
                      <Info className="w-3 h-3 inline mr-1" />
                      This appears to be a temporary network issue. The system will retry automatically.
                    </p>
                  )}
                </div>
              </AlertDescription>
            </Alert>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              {canRetry && (
                <Button onClick={this.handleRetry} size="sm">
                  <RefreshCcw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
              >
                Reload Page
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={this.toggleDetails}
              >
                {showDetails ? (
                  <>
                    <ChevronUp className="w-4 h-4 mr-1" />
                    Hide Details
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 mr-1" />
                    Show Details
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={this.copyErrorDetails}
              >
                <Copy className="w-4 h-4 mr-1" />
                Copy Error
              </Button>

              {showReportButton && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={this.reportError}
                >
                  <ExternalLink className="w-4 h-4 mr-1" />
                  Report Bug
                </Button>
              )}
            </div>

            {/* Auto-retry for transient errors */}
            {isTransientError && canRetry && (
              <div className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={this.handleAutoRetry}
                  className="text-blue-600"
                >
                  Auto-retry in 2 seconds...
                </Button>
              </div>
            )}

            {/* Error Details */}
            {showDetails && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Technical Details</h4>
                  
                  {error?.stack && (
                    <div>
                      <h5 className="text-xs font-medium mb-1">Stack Trace:</h5>
                      <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                        {error.stack}
                      </pre>
                    </div>
                  )}

                  {errorInfo?.componentStack && (
                    <div>
                      <h5 className="text-xs font-medium mb-1">Component Stack:</h5>
                      <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                        {errorInfo.componentStack}
                      </pre>
                    </div>
                  )}

                  <div className="text-xs text-gray-500 space-y-1">
                    <p>Browser: {navigator.userAgent}</p>
                    <p>URL: {window.location.href}</p>
                    <p>Timestamp: {new Date().toLocaleString()}</p>
                    {retryCount > 0 && <p>Retry Count: {retryCount}</p>}
                  </div>
                </div>
              </>
            )}

            {/* Retry Limit Reached */}
            {!canRetry && (
              <Alert>
                <X className="h-4 w-4" />
                <AlertDescription>
                  Maximum retry attempts reached. Please refresh the page or contact support if the problem persists.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      );
    }

    return children;
  }
}

// Hook for functional components to trigger error boundaries
export function useErrorHandler() {
  return (error: Error, errorInfo?: any) => {
    // This will be caught by the nearest error boundary
    throw error;
  };
}

// Higher-order component for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Specialized error boundaries for different use cases

export function TranscriptionErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // Log transcription-specific errors
        console.error('Transcription error:', error, errorInfo);
        // Track analytics event
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', 'transcription_error', {
            error_name: error.name,
            error_message: error.message,
          });
        }
      }}
      fallback={
        <Card className="w-full border-red-200">
          <CardContent className="pt-6">
            <div className="text-center space-y-3">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
              <h3 className="text-lg font-medium">Transcription Error</h3>
              <p className="text-sm text-gray-600">
                There was an error processing your audio file. Please try a different transcription method or contact support.
              </p>
              <Button onClick={() => window.location.reload()} size="sm">
                <RefreshCcw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

export function WhisperErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Whisper WebAssembly error:', error, errorInfo);
      }}
      fallback={
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">WebAssembly Error</p>
              <p className="text-sm">
                There was an error loading the Whisper WebAssembly module. 
                Your browser may not support WebAssembly or the model files may be corrupted.
              </p>
              <p className="text-xs">
                Try using the OpenAI API method instead, or update your browser.
              </p>
            </div>
          </AlertDescription>
        </Alert>
      }
    >
      {children}
    </ErrorBoundary>
  );
}