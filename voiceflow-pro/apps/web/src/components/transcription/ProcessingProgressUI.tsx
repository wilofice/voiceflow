"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Clock,
  Cpu,
  HardDrive,
  Zap,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Download,
  Upload,
  Brain,
  FileAudio,
  Activity
} from 'lucide-react';

export interface ProcessingStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  progress: number;
  estimatedTime?: number;
  actualTime?: number;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ProcessingProgressUIProps {
  steps: ProcessingStep[];
  currentStep?: string;
  method: 'openai' | 'browser' | 'server';
  fileName?: string;
  fileSize?: number;
  onCancel?: () => void;
  onRetry?: (stepId: string) => void;
  className?: string;
}

interface StepCardProps {
  step: ProcessingStep;
  isActive: boolean;
  method: string;
  onRetry?: (stepId: string) => void;
}

function StepCard({ step, isActive, method, onRetry }: StepCardProps) {
  const getIcon = () => {
    switch (step.id) {
      case 'upload':
        return <Upload className="w-4 h-4" />;
      case 'validate':
        return <FileAudio className="w-4 h-4" />;
      case 'preprocess':
        return <Activity className="w-4 h-4" />;
      case 'transcribe':
        return <Brain className="w-4 h-4" />;
      case 'postprocess':
        return <Cpu className="w-4 h-4" />;
      case 'save':
        return <HardDrive className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusIcon = () => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'in_progress':
        return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (step.status) {
      case 'completed':
        return 'border-green-200 bg-green-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      case 'in_progress':
        return 'border-blue-200 bg-blue-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const formatTime = (seconds?: number) => {
    if (!seconds) return '';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className={`p-4 rounded-lg border-2 transition-all ${getStatusColor()}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 mt-0.5">
            {getIcon()}
          </div>
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h4 className="font-medium text-sm">{step.name}</h4>
              {getStatusIcon()}
            </div>
            <p className="text-xs text-gray-600 mt-1">{step.description}</p>
            
            {/* Progress Bar */}
            {(step.status === 'in_progress' || step.progress > 0) && (
              <div className="mt-2">
                <Progress value={step.progress} className="h-1" />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>{Math.round(step.progress)}%</span>
                  {step.estimatedTime && step.status === 'in_progress' && (
                    <span>~{formatTime(step.estimatedTime)}</span>
                  )}
                </div>
              </div>
            )}

            {/* Timing Info */}
            {(step.actualTime || step.estimatedTime) && step.status !== 'in_progress' && (
              <div className="flex items-center space-x-4 text-xs text-gray-500 mt-2">
                {step.actualTime && (
                  <span>Took {formatTime(step.actualTime)}</span>
                )}
                {step.estimatedTime && step.status === 'pending' && (
                  <span>~{formatTime(step.estimatedTime)} estimated</span>
                )}
              </div>
            )}

            {/* Metadata */}
            {step.metadata && Object.keys(step.metadata).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {Object.entries(step.metadata).map(([key, value]) => (
                  <Badge key={key} variant="outline" className="text-xs">
                    {key}: {String(value)}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        {step.status === 'error' && onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRetry(step.id)}
            className="h-7 px-2 text-xs"
          >
            Retry
          </Button>
        )}
      </div>

      {/* Error Message */}
      {step.error && (
        <Alert variant="destructive" className="mt-3">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {step.error}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function MethodBadge({ method }: { method: string }) {
  const getMethodInfo = () => {
    switch (method) {
      case 'openai':
        return {
          icon: <Zap className="w-3 h-3" />,
          label: 'OpenAI Whisper API',
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200'
        };
      case 'browser':
        return {
          icon: <HardDrive className="w-3 h-3" />,
          label: 'Browser Processing',
          color: 'bg-green-100 text-green-800 border-green-200'
        };
      case 'server':
        return {
          icon: <Cpu className="w-3 h-3" />,
          label: 'Server Processing',
          color: 'bg-blue-100 text-blue-800 border-blue-200'
        };
      default:
        return {
          icon: <Clock className="w-3 h-3" />,
          label: 'Unknown Method',
          color: 'bg-gray-100 text-gray-800 border-gray-200'
        };
    }
  };

  const methodInfo = getMethodInfo();

  return (
    <Badge className={`text-xs font-medium border ${methodInfo.color}`}>
      {methodInfo.icon}
      <span className="ml-1">{methodInfo.label}</span>
    </Badge>
  );
}

export function ProcessingProgressUI({
  steps,
  currentStep,
  method,
  fileName,
  fileSize,
  onCancel,
  onRetry,
  className = ''
}: ProcessingProgressUIProps) {
  const [totalProgress, setTotalProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime] = useState(Date.now());

  // Update elapsed time
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime((Date.now() - startTime) / 1000);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  // Calculate total progress
  useEffect(() => {
    const completedSteps = steps.filter(s => s.status === 'completed').length;
    const inProgressStep = steps.find(s => s.status === 'in_progress');
    const inProgressWeight = inProgressStep ? inProgressStep.progress / 100 : 0;
    
    const totalSteps = steps.length;
    const total = ((completedSteps + inProgressWeight) / totalSteps) * 100;
    setTotalProgress(Math.round(total));
  }, [steps]);

  const hasErrors = steps.some(s => s.status === 'error');
  const isCompleted = steps.every(s => s.status === 'completed');
  const isProcessing = steps.some(s => s.status === 'in_progress');

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatElapsedTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center space-x-2">
            <FileAudio className="w-4 h-4" />
            <span>Processing</span>
            {isCompleted && <CheckCircle className="w-4 h-4 text-green-600" />}
            {hasErrors && <XCircle className="w-4 h-4 text-red-600" />}
          </CardTitle>
          
          <div className="flex items-center space-x-2">
            <MethodBadge method={method} />
            {onCancel && isProcessing && (
              <Button
                variant="outline"
                size="sm"
                onClick={onCancel}
                className="h-7 px-2 text-xs"
              >
                Cancel
              </Button>
            )}
          </div>
        </div>

        {/* File Info */}
        {fileName && (
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <span className="font-medium truncate max-w-48">{fileName}</span>
              {fileSize && <span>{formatFileSize(fileSize)}</span>}
            </div>
            <div className="flex items-center space-x-3 text-xs">
              <span>{formatElapsedTime(elapsedTime)}</span>
              <Badge variant="outline" className="text-xs">
                {totalProgress}%
              </Badge>
            </div>
          </div>
        )}

        {/* Total Progress */}
        <div className="space-y-2">
          <Progress value={totalProgress} className="h-2" />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {steps.map((step) => (
          <StepCard
            key={step.id}
            step={step}
            isActive={step.id === currentStep}
            method={method}
            onRetry={onRetry}
          />
        ))}

        {/* Summary */}
        {(isCompleted || hasErrors) && (
          <div className="pt-4 border-t">
            {isCompleted && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Processing completed successfully in {formatElapsedTime(elapsedTime)}
                </AlertDescription>
              </Alert>
            )}
            
            {hasErrors && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  Processing failed. Some steps encountered errors.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}