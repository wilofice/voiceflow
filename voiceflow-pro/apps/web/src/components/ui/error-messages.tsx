"use client";

import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from './alert';
import { Button } from './button';
import { Badge } from './badge';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Progress } from './progress';
import {
  AlertTriangle,
  XCircle,
  AlertCircle,
  Info,
  Wifi,
  WifiOff,
  Clock,
  Shield,
  Zap,
  RefreshCcw,
  X,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  HelpCircle
} from 'lucide-react';

// Generic error message types
export type ErrorType = 
  | 'network' 
  | 'validation' 
  | 'authentication' 
  | 'authorization' 
  | 'file' 
  | 'transcription' 
  | 'model' 
  | 'quota' 
  | 'timeout' 
  | 'browser' 
  | 'unknown';

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface ErrorDetails {
  type: ErrorType;
  severity: ErrorSeverity;
  title: string;
  message: string;
  code?: string;
  suggestion?: string;
  action?: {
    label: string;
    handler: () => void;
  };
  details?: string;
  timestamp?: Date;
  retryable?: boolean;
}

interface ErrorMessageProps {
  error: ErrorDetails;
  onDismiss?: () => void;
  onRetry?: () => void;
  className?: string;
}

function getErrorIcon(type: ErrorType, severity: ErrorSeverity) {
  if (severity === 'critical') return <XCircle className="w-4 h-4" />;
  if (severity === 'error') return <AlertTriangle className="w-4 h-4" />;
  if (severity === 'warning') return <AlertCircle className="w-4 h-4" />;
  
  switch (type) {
    case 'network':
      return <WifiOff className="w-4 h-4" />;
    case 'authentication':
    case 'authorization':
      return <Shield className="w-4 h-4" />;
    case 'timeout':
      return <Clock className="w-4 h-4" />;
    case 'transcription':
      return <Zap className="w-4 h-4" />;
    default:
      return <Info className="w-4 h-4" />;
  }
}

function getErrorVariant(severity: ErrorSeverity): 'default' | 'destructive' {
  return severity === 'error' || severity === 'critical' ? 'destructive' : 'default';
}

export function ErrorMessage({ error, onDismiss, onRetry, className }: ErrorMessageProps) {
  const [showDetails, setShowDetails] = useState(false);
  const icon = getErrorIcon(error.type, error.severity);
  const variant = getErrorVariant(error.severity);

  return (
    <Alert variant={variant} className={className}>
      {icon}
      <div className="flex-1">
        <AlertTitle className="flex items-center justify-between">
          <span>{error.title}</span>
          <div className="flex items-center space-x-2">
            {error.code && (
              <Badge variant="outline" className="text-xs">
                {error.code}
              </Badge>
            )}
            {onDismiss && (
              <Button variant="ghost" size="sm" onClick={onDismiss} className="h-4 w-4 p-0">
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        </AlertTitle>
        
        <AlertDescription className="space-y-3">
          <p>{error.message}</p>
          
          {error.suggestion && (
            <p className="text-sm bg-blue-50 text-blue-800 p-2 rounded">
              <Info className="w-3 h-3 inline mr-1" />
              {error.suggestion}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {error.retryable && onRetry && (
              <Button size="sm" onClick={onRetry} variant="outline">
                <RefreshCcw className="w-3 h-3 mr-1" />
                Try Again
              </Button>
            )}
            
            {error.action && (
              <Button size="sm" onClick={error.action.handler} variant="outline">
                {error.action.label}
              </Button>
            )}

            {error.details && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? (
                  <>
                    <ChevronUp className="w-3 h-3 mr-1" />
                    Hide Details
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3 mr-1" />
                    Show Details
                  </>
                )}
              </Button>
            )}
          </div>

          {showDetails && error.details && (
            <div className="mt-3 p-2 bg-gray-100 rounded text-xs">
              <pre className="whitespace-pre-wrap">{error.details}</pre>
            </div>
          )}

          {error.timestamp && (
            <p className="text-xs text-gray-500">
              {error.timestamp.toLocaleString()}
            </p>
          )}
        </AlertDescription>
      </div>
    </Alert>
  );
}

// Specialized error components for common scenarios

export function NetworkError({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorMessage
      error={{
        type: 'network',
        severity: 'error',
        title: 'Network Error',
        message: 'Unable to connect to the server. Please check your internet connection.',
        suggestion: 'Make sure you are connected to the internet and try again.',
        retryable: true,
      }}
      onRetry={onRetry}
    />
  );
}

export function FileUploadError({ 
  fileName, 
  reason, 
  onRetry 
}: { 
  fileName?: string; 
  reason: string; 
  onRetry?: () => void; 
}) {
  return (
    <ErrorMessage
      error={{
        type: 'file',
        severity: 'error',
        title: 'File Upload Error',
        message: `Failed to upload ${fileName || 'file'}: ${reason}`,
        suggestion: 'Check that your file is not corrupted and try uploading again.',
        retryable: true,
      }}
      onRetry={onRetry}
    />
  );
}

export function TranscriptionError({ 
  method, 
  reason, 
  onSwitchMethod, 
  onRetry 
}: {
  method: string;
  reason: string;
  onSwitchMethod?: () => void;
  onRetry?: () => void;
}) {
  return (
    <ErrorMessage
      error={{
        type: 'transcription',
        severity: 'error',
        title: 'Transcription Failed',
        message: `${method} transcription failed: ${reason}`,
        suggestion: 'Try using a different transcription method or check your audio file quality.',
        retryable: !!onRetry,
        action: onSwitchMethod ? {
          label: 'Switch Method',
          handler: onSwitchMethod
        } : undefined,
      }}
      onRetry={onRetry}
    />
  );
}

export function ModelLoadingError({ 
  modelName, 
  onRetry, 
  onUseAlternative 
}: {
  modelName: string;
  onRetry?: () => void;
  onUseAlternative?: () => void;
}) {
  return (
    <ErrorMessage
      error={{
        type: 'model',
        severity: 'error',
        title: 'Model Loading Error',
        message: `Failed to load ${modelName} model. The model file may be corrupted or your browser may not support WebAssembly.`,
        suggestion: 'Try downloading the model again or use the OpenAI API instead.',
        retryable: !!onRetry,
        action: onUseAlternative ? {
          label: 'Use OpenAI API',
          handler: onUseAlternative
        } : undefined,
      }}
      onRetry={onRetry}
    />
  );
}

export function QuotaExceededError({ 
  service, 
  resetDate, 
  onUpgrade 
}: {
  service: string;
  resetDate?: Date;
  onUpgrade?: () => void;
}) {
  return (
    <ErrorMessage
      error={{
        type: 'quota',
        severity: 'warning',
        title: 'Usage Limit Reached',
        message: `You have reached your ${service} usage limit.`,
        suggestion: resetDate 
          ? `Your quota will reset on ${resetDate.toLocaleDateString()}.`
          : 'Consider upgrading your plan for higher limits.',
        action: onUpgrade ? {
          label: 'Upgrade Plan',
          handler: onUpgrade
        } : undefined,
      }}
    />
  );
}

export function BrowserCompatibilityError({ feature }: { feature: string }) {
  return (
    <ErrorMessage
      error={{
        type: 'browser',
        severity: 'error',
        title: 'Browser Not Supported',
        message: `Your browser does not support ${feature}.`,
        suggestion: 'Please update your browser or use a modern browser like Chrome, Firefox, or Safari.',
        action: {
          label: 'Learn More',
          handler: () => window.open('https://caniuse.com/', '_blank')
        }
      }}
    />
  );
}

// Error collection component for showing multiple errors
export function ErrorCollection({ 
  errors, 
  onClearAll,
  className 
}: {
  errors: (ErrorDetails & { id: string })[];
  onClearAll?: () => void;
  className?: string;
}) {
  if (errors.length === 0) return null;

  const criticalErrors = errors.filter(e => e.severity === 'critical');
  const otherErrors = errors.filter(e => e.severity !== 'critical');

  return (
    <div className={`space-y-2 ${className}`}>
      {onClearAll && errors.length > 1 && (
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">
            {errors.length} error{errors.length > 1 ? 's' : ''}
          </span>
          <Button variant="ghost" size="sm" onClick={onClearAll}>
            Clear All
          </Button>
        </div>
      )}

      {/* Show critical errors first */}
      {criticalErrors.map((error) => (
        <ErrorMessage key={error.id} error={error} />
      ))}

      {/* Show other errors */}
      {otherErrors.map((error) => (
        <ErrorMessage key={error.id} error={error} />
      ))}
    </div>
  );
}

// Connection status indicator
export function ConnectionStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        // Show reconnected message briefly
        setTimeout(() => setWasOffline(false), 3000);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    setIsOnline(navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  if (isOnline && !wasOffline) return null;

  return (
    <Alert variant={isOnline ? 'default' : 'destructive'} className="mb-4">
      {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
      <AlertDescription>
        {isOnline 
          ? 'Connection restored. You can continue using the application.'
          : 'No internet connection. Some features may not work properly.'
        }
      </AlertDescription>
    </Alert>
  );
}

// Progress with error states
export function ProgressWithError({
  value,
  error,
  onRetry,
  className
}: {
  value: number;
  error?: ErrorDetails | null;
  onRetry?: () => void;
  className?: string;
}) {
  if (error) {
    return (
      <div className={className}>
        <ErrorMessage error={error} onRetry={onRetry} />
      </div>
    );
  }

  return (
    <Progress 
      value={value} 
      className={className}
    />
  );
}