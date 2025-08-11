'use client';

import { TranscriptStatus } from '@voiceflow-pro/shared';
import { cn } from '@/lib/utils';

interface TranscriptProgressProps {
  status: TranscriptStatus;
  progress?: number;
  className?: string;
  onRetry?: () => void;
}

export function TranscriptProgress({
  status,
  progress = 0,
  className,
  onRetry,
}: TranscriptProgressProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'QUEUED':
        return 'bg-yellow-500';
      case 'PROCESSING':
        return 'bg-blue-500';
      case 'COMPLETED':
        return 'bg-green-500';
      case 'FAILED':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'QUEUED':
        return 'Waiting in queue...';
      case 'PROCESSING':
        return 'Transcribing audio...';
      case 'COMPLETED':
        return 'Transcription completed';
      case 'FAILED':
        return 'Transcription failed';
      default:
        return 'Unknown status';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'QUEUED':
        return '⏳';
      case 'PROCESSING':
        return '🔄';
      case 'COMPLETED':
        return '✅';
      case 'FAILED':
        return '❌';
      default:
        return '❓';
    }
  };

  return (
    <div className={cn('bg-white rounded-lg p-4 shadow', className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">{getStatusIcon()}</span>
          <div>
            <h4 className="font-medium text-gray-900">{getStatusText()}</h4>
            <p className="text-sm text-gray-500">Status: {status}</p>
          </div>
        </div>
        {status === 'FAILED' && onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        )}
      </div>

      {(status === 'PROCESSING' || status === 'QUEUED') && (
        <div className="mt-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                getStatusColor()
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {status === 'PROCESSING' && (
        <div className="mt-4 flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm text-gray-600">
            Processing your audio file with OpenAI Whisper...
          </span>
        </div>
      )}

      {status === 'COMPLETED' && (
        <div className="mt-4 p-3 bg-green-50 rounded">
          <p className="text-sm text-green-800">
            Your transcription is ready! You can now view, edit, and share it.
          </p>
        </div>
      )}

      {status === 'FAILED' && (
        <div className="mt-4 p-3 bg-red-50 rounded">
          <p className="text-sm text-red-800">
            We encountered an error while transcribing your audio. This might be due to:
          </p>
          <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
            <li>Unsupported audio format</li>
            <li>File corruption</li>
            <li>Network issues</li>
            <li>Service temporarily unavailable</li>
          </ul>
        </div>
      )}
    </div>
  );
}