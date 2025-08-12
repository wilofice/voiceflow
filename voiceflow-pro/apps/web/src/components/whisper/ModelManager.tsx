'use client';

import { useState, useEffect, useCallback } from 'react';
import { WhisperModelManager, ModelInfo, StorageInfo, DownloadProgress } from '@/lib/whisper/modelManager';
import { formatFileSize } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Download,
  Trash2,
  HardDrive,
  Wifi,
  WifiOff,
  CheckCircle,
  AlertCircle,
  Clock,
  Zap,
  Gauge,
  Globe
} from 'lucide-react';

export interface ModelManagerProps {
  onModelChange?: (modelId: string, downloaded: boolean) => void;
  className?: string;
}

export function ModelManager({ onModelChange, className = '' }: ModelManagerProps) {
  const [modelManager] = useState(() => WhisperModelManager.getInstance());
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, DownloadProgress>>({});
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [loading, setLoading] = useState(true);

  // Update online status
  useEffect(() => {
    const handleOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, []);

  // Load models and storage info
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [modelsData, storage] = await Promise.all([
        modelManager.getAvailableModels(),
        modelManager.getStorageInfo(),
      ]);
      setModels(modelsData);
      setStorageInfo(storage);
    } catch (error) {
      console.error('Failed to load model data:', error);
    } finally {
      setLoading(false);
    }
  }, [modelManager]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Listen to model manager events
  useEffect(() => {
    const handleDownloadProgress = (progress: DownloadProgress) => {
      setDownloadProgress(prev => ({
        ...prev,
        [progress.modelId]: progress,
      }));
    };

    const handleDownloadComplete = ({ modelId }: { modelId: string }) => {
      setDownloadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[modelId];
        return newProgress;
      });
      loadData(); // Refresh data
      onModelChange?.(modelId, true);
    };

    const handleModelDeleted = ({ modelId }: { modelId: string }) => {
      loadData(); // Refresh data
      onModelChange?.(modelId, false);
    };

    modelManager.on('downloadProgress', handleDownloadProgress);
    modelManager.on('downloadComplete', handleDownloadComplete);
    modelManager.on('modelDeleted', handleModelDeleted);

    return () => {
      modelManager.off('downloadProgress', handleDownloadProgress);
      modelManager.off('downloadComplete', handleDownloadComplete);
      modelManager.off('modelDeleted', handleModelDeleted);
    };
  }, [modelManager, loadData, onModelChange]);

  const handleDownloadModel = async (modelId: string) => {
    if (!isOnline) {
      alert('Internet connection required to download models');
      return;
    }

    try {
      await modelManager.downloadModel(modelId as any);
    } catch (error: any) {
      console.error(`Failed to download model ${modelId}:`, error);
      alert(`Failed to download model: ${error.message}`);
    }
  };

  const handleDeleteModel = async (modelId: string) => {
    if (confirm(`Are you sure you want to delete the ${modelId} model? This will free up storage space but you'll need to re-download it to use it again.`)) {
      try {
        await modelManager.deleteModel(modelId as any);
      } catch (error: any) {
        console.error(`Failed to delete model ${modelId}:`, error);
        alert(`Failed to delete model: ${error.message}`);
      }
    }
  };

  const getLanguageIcon = (language: ModelInfo['language']) => {
    return language === 'multilingual' ? <Globe className="w-4 h-4" /> : <span className="text-xs">EN</span>;
  };

  const getSpeedIcon = (speed: string) => {
    if (speed.includes('32x')) return <Zap className="w-4 h-4 text-green-500" />;
    if (speed.includes('16x')) return <Zap className="w-4 h-4 text-blue-500" />;
    if (speed.includes('6x')) return <Gauge className="w-4 h-4 text-yellow-500" />;
    return <Clock className="w-4 h-4 text-orange-500" />;
  };

  const formatDownloadTime = (timeRemaining: number) => {
    if (timeRemaining < 60) return `${Math.round(timeRemaining)}s`;
    if (timeRemaining < 3600) return `${Math.round(timeRemaining / 60)}m`;
    return `${Math.round(timeRemaining / 3600)}h`;
  };

  const formatSpeed = (bytesPerSecond: number) => {
    if (bytesPerSecond < 1024) return `${Math.round(bytesPerSecond)} B/s`;
    if (bytesPerSecond < 1024 * 1024) return `${Math.round(bytesPerSecond / 1024)} KB/s`;
    return `${Math.round(bytesPerSecond / (1024 * 1024))} MB/s`;
  };

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Whisper Model Manager</h3>
        <p className="text-sm text-gray-600">
          Download and manage Whisper models for offline transcription. Larger models provide better accuracy but require more storage space.
        </p>
      </div>

      {/* Offline Warning */}
      {!isOnline && (
        <Alert variant="destructive">
          <WifiOff className="h-4 w-4" />
          <AlertDescription>
            You're offline. Model downloads are not available. Already downloaded models can still be used.
          </AlertDescription>
        </Alert>
      )}

      {/* Storage Info */}
      {storageInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center space-x-2">
              <HardDrive className="w-4 h-4" />
              <span>Storage Usage</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Used Storage</span>
                <span>{formatFileSize(storageInfo.used)}</span>
              </div>
              <Progress 
                value={(storageInfo.used / storageInfo.quota) * 100} 
                className="h-2"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>{formatFileSize(storageInfo.available)} available</span>
                <span>{formatFileSize(storageInfo.quota)} total</span>
              </div>
              <div className="text-xs text-gray-600">
                {storageInfo.models.length} model{storageInfo.models.length !== 1 ? 's' : ''} downloaded
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Models */}
      <div className="space-y-4">
        {models.map((model) => {
          const progress = downloadProgress[model.id];
          const isDownloading = !!progress;
          const hasStorage = !storageInfo || storageInfo.available >= model.size;

          return (
            <Card key={model.id} className="relative overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center space-x-3">
                      <CardTitle className="text-base">{model.name}</CardTitle>
                      <div className="flex items-center space-x-2">
                        {getLanguageIcon(model.language)}
                        {getSpeedIcon(model.speed)}
                      </div>
                    </div>
                    <CardDescription>{model.description}</CardDescription>
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span>{model.sizeFormatted}</span>
                      <span>{model.accuracy} accuracy</span>
                      <span>{model.speed} processing</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {model.language === 'multilingual' && (
                      <Badge variant="secondary" className="text-xs">Multi-lang</Badge>
                    )}
                    {model.downloaded ? (
                      <Badge variant="default" className="text-xs">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Downloaded
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        Not Downloaded
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {/* Download Progress */}
                {isDownloading && (
                  <div className="space-y-3 mb-4">
                    <div className="flex justify-between text-sm">
                      <span>
                        {progress.status === 'downloading' ? 'Downloading...' :
                         progress.status === 'processing' ? 'Processing...' :
                         progress.status === 'complete' ? 'Complete!' : 'Error'}
                      </span>
                      <span>{Math.round(progress.progress)}%</span>
                    </div>
                    
                    <Progress value={progress.progress} className="h-2" />
                    
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>
                        {formatFileSize(progress.downloaded)} / {formatFileSize(progress.total)}
                      </span>
                      <span>
                        {progress.speed > 0 && (
                          <>
                            {formatSpeed(progress.speed)} • {formatDownloadTime(progress.timeRemaining)} remaining
                          </>
                        )}
                      </span>
                    </div>

                    {progress.status === 'error' && progress.error && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{progress.error}</AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                {/* Storage Warning */}
                {!hasStorage && !model.downloaded && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Insufficient storage space. Need {formatFileSize(model.size - (storageInfo?.available || 0))} more space.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Actions */}
                <div className="flex justify-between items-center">
                  <div className="text-xs text-gray-500">
                    {model.lastUsed && (
                      <span>Last used: {new Date(model.lastUsed).toLocaleDateString()}</span>
                    )}
                  </div>

                  <div className="flex space-x-2">
                    {model.downloaded ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteModel(model.id)}
                        className="text-xs"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Delete
                      </Button>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleDownloadModel(model.id)}
                        disabled={isDownloading || !isOnline || !hasStorage}
                        className="text-xs"
                      >
                        <Download className="w-3 h-3 mr-1" />
                        {isOnline ? 'Download' : 'Offline'}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>

              {/* Loading Overlay */}
              {isDownloading && (
                <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Recommendations */}
      <Card className="bg-blue-50">
        <CardHeader>
          <CardTitle className="text-base text-blue-900">💡 Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-blue-800">
            <p><strong>For real-time use:</strong> Download the Tiny model (39MB) for instant transcription</p>
            <p><strong>For best quality:</strong> Download the Base model (142MB) for balanced performance</p>
            <p><strong>For professional use:</strong> Consider the Small model (466MB) for higher accuracy</p>
            <p><strong>Storage tip:</strong> You can delete models you don't use to free up space</p>
          </div>
        </CardContent>
      </Card>

      {/* Network Status */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center space-x-1">
          {isOnline ? (
            <>
              <Wifi className="w-3 h-3 text-green-500" />
              <span>Online - Downloads available</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-red-500" />
              <span>Offline - Using cached models only</span>
            </>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={loadData}
          className="text-xs h-6 px-2"
        >
          Refresh
        </Button>
      </div>
    </div>
  );
}