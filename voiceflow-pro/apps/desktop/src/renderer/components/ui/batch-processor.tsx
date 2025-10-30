import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  Square,
  FileAudio,
  Upload,
  Settings2,
  MoreHorizontal,
  Clock,
  Zap,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Trash2,
  Loader2,
  FolderOpen,
} from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useBatchStore } from '@/stores/batchStore';
import { useToast } from '@/hooks/use-toast';
import { BatchItem as BatchItemType } from '@/types/api';


interface BatchProcessorProps {
  className?: string;
  jobId?: string | null;
  onJobChange?: (jobId: string | null) => void;
}

export const BatchProcessor: React.FC<BatchProcessorProps> = ({
  className,
  jobId,
  onJobChange,
}) => {
  const { toast } = useToast();
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);

  const {
    currentJob,
    isLoading,
    startJob,
    pauseJob,
    resumeJob,
    cancelJob,
    addFiles,
    retryItem,
    removeItem,
    fetchJob,
  } = useBatchStore();

  // Fetch job data when jobId changes
  useEffect(() => {
    if (jobId) {
      fetchJob(jobId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]); // Only re-run when jobId changes, not when fetchJob reference changes

  // File upload with dropzone
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: useCallback(async (acceptedFiles: File[]) => {
      if (!jobId || !currentJob) {
        toast({
          title: 'No Job Selected',
          description: 'Please select a batch job first',
          variant: 'destructive',
        });
        return;
      }

      if (currentJob.status !== 'DRAFT') {
        toast({
          title: 'Cannot Add Files',
          description: 'Can only add files to DRAFT jobs',
          variant: 'destructive',
        });
        return;
      }

      setIsUploading(true);
      try {
        await addFiles(jobId, acceptedFiles);
        toast({
          title: 'Files Added',
          description: `Successfully added ${acceptedFiles.length} file(s)`,
        });
      } catch (error) {
        toast({
          title: 'Upload Failed',
          description: error instanceof Error ? error.message : 'Failed to upload files',
          variant: 'destructive',
        });
      } finally {
        setIsUploading(false);
      }
    }, [jobId, currentJob, addFiles, toast]),
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a', '.ogg', '.opus'],
      'video/*': ['.mp4', '.mov', '.quicktime'],
    },
    multiple: true,
    disabled: !jobId || currentJob?.status !== 'DRAFT',
  });

  const job = currentJob;
  const items = currentJob?.items || [];

  // Event handlers
  const handleStart = async () => {
    if (!jobId) return;
    try {
      await startJob(jobId);
      toast({ title: 'Batch Job Started', description: 'Processing files...' });
    } catch (error) {
      toast({
        title: 'Failed to Start',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handlePause = async () => {
    if (!jobId) return;
    try {
      await pauseJob(jobId);
      toast({ title: 'Batch Job Paused' });
    } catch (error) {
      toast({
        title: 'Failed to Pause',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleResume = async () => {
    if (!jobId) return;
    try {
      await resumeJob(jobId);
      toast({ title: 'Batch Job Resumed' });
    } catch (error) {
      toast({
        title: 'Failed to Resume',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleCancel = async () => {
    if (!jobId) return;
    try {
      await cancelJob(jobId);
      toast({ title: 'Batch Job Cancelled' });
    } catch (error) {
      toast({
        title: 'Failed to Cancel',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleRetry = async (itemId: string) => {
    if (!jobId) return;
    try {
      await retryItem(jobId, itemId);
      toast({ title: 'Item Queued for Retry' });
    } catch (error) {
      toast({
        title: 'Failed to Retry',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleRemove = async (itemId: string) => {
    if (!jobId) return;
    try {
      await removeItem(jobId, itemId);
      toast({ title: 'Item Removed' });
    } catch (error) {
      toast({
        title: 'Failed to Remove',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  // Helper functions
  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number): string => {
    if (!seconds) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatETA = (seconds?: number | null): string => {
    if (!seconds) return '--';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.ceil((seconds % 3600) / 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getStatusIcon = (status: BatchItemType['status']) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'PROCESSING':
        return <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />;
      case 'ERROR':
        return <XCircle className="w-4 h-4 text-danger" />;
      case 'PENDING':
        return <Clock className="w-4 h-4 text-text-muted" />;
      case 'CANCELLED':
        return <Square className="w-4 h-4 text-text-muted" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: BatchItemType['status']) => {
    const variants = {
      COMPLETED: { label: 'Complete', className: 'text-success border-success' },
      PROCESSING: { label: 'Processing', className: 'text-primary border-primary animate-pulse' },
      ERROR: { label: 'Error', className: 'text-danger border-danger' },
      PENDING: { label: 'Pending', className: 'text-text-muted border-text-muted' },
      CANCELLED: { label: 'Cancelled', className: 'text-text-muted border-text-muted' },
    };

    const variant = variants[status];
    return (
      <Badge variant="outline" className={cn('text-xs', variant.className)}>
        {variant.label}
      </Badge>
    );
  };

  // Empty state - no job selected
  if (!jobId) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full bg-background", className)}>
        <FolderOpen className="w-16 h-16 text-text-muted mb-4" />
        <h3 className="text-lg font-semibold text-text-primary mb-2">No Batch Job Selected</h3>
        <p className="text-sm text-text-secondary text-center max-w-md">
          Select an existing batch job from the sidebar or create a new one to get started with batch transcription.
        </p>
      </div>
    );
  }

  // Loading state - fetching job data
  if (isLoading && !job) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full bg-background", className)}>
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-sm text-text-secondary">Loading batch job...</p>
      </div>
    );
  }

  // Job not found
  if (!job) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full bg-background", className)}>
        <AlertTriangle className="w-16 h-16 text-warning mb-4" />
        <h3 className="text-lg font-semibold text-text-primary mb-2">Job Not Found</h3>
        <p className="text-sm text-text-secondary">
          The selected batch job could not be loaded.
        </p>
      </div>
    );
  }

  const overallProgress = job.totalItems > 0 ? (job.completedItems / job.totalItems) * 100 : 0;

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {/* Header */}
      <header className="flex items-center justify-between p-6 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-1">{job.name}</h1>
          <div className="flex items-center gap-4 text-sm text-text-secondary">
            <span>Created {new Date(job.createdAt).toLocaleDateString()}</span>
            <span>•</span>
            <span>{job.completedItems}/{job.totalItems} completed</span>
            {job.failedItems > 0 && (
              <>
                <span>•</span>
                <span className="text-danger">{job.failedItems} failed</span>
              </>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {job.status === 'DRAFT' && (
            <div {...getRootProps()}>
              <input {...getInputProps()} />
              <Button
                variant="outline"
                className="focus-ring"
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Add Files
                  </>
                )}
              </Button>
            </div>
          )}
          <Separator orientation="vertical" className="h-6" />

          {job.status === 'RUNNING' ? (
            <>
              <Button variant="outline" onClick={handlePause} className="focus-ring">
                <Pause className="w-4 h-4 mr-2" />
                Pause
              </Button>
              <Button variant="outline" onClick={handleCancel} className="focus-ring">
                <Square className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </>
          ) : job.status === 'PAUSED' ? (
            <>
              <Button onClick={handleResume} className="bg-gradient-primary hover:opacity-90 focus-ring">
                <Play className="w-4 h-4 mr-2" />
                Resume
              </Button>
              <Button variant="outline" onClick={handleCancel} className="focus-ring">
                <Square className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </>
          ) : job.status === 'DRAFT' && job.totalItems > 0 ? (
            <Button onClick={handleStart} className="bg-gradient-primary hover:opacity-90 focus-ring">
              <Play className="w-4 h-4 mr-2" />
              Start Batch
            </Button>
          ) : null}
        </div>
      </header>

      {/* Stats Overview */}
      <div className="p-6 border-b border-border bg-surface-alt/20">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-secondary">Overall Progress</p>
                  <p className="text-2xl font-bold text-text-primary">
                    {Math.round(overallProgress)}%
                  </p>
                </div>
                <Zap className="w-8 h-8 text-primary" />
              </div>
              <Progress value={overallProgress} className="mt-2" />
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-secondary">Time Remaining</p>
                  <p className="text-2xl font-bold text-text-primary">
                    {formatETA(job.estimatedTimeRemaining)}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-warning" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-secondary">Throughput</p>
                  <p className="text-2xl font-bold text-text-primary">
                    {job.throughputMbps?.toFixed(1) || '--'} MB/s
                  </p>
                </div>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <RotateCcw className="w-8 h-8 text-success" />
                </motion.div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-secondary">Concurrency</p>
                  <p className="text-2xl font-bold text-text-primary">
                    {job.concurrency}x
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "w-2 h-2 rounded-full",
                        i < job.concurrency ? "bg-primary animate-pulse" : "bg-border"
                      )}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Items List */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          {/* Dropzone for file upload (DRAFT jobs with no items) */}
          {job.status === 'DRAFT' && items.length === 0 && (
            <div
              {...getRootProps()}
              className={cn(
                'border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors mb-6',
                isDragActive
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50 hover:bg-surface-alt/50'
              )}
            >
              <input {...getInputProps()} />
              <Upload className="w-12 h-12 mx-auto mb-4 text-text-muted" />
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                {isDragActive ? 'Drop files here' : 'Upload Audio Files'}
              </h3>
              <p className="text-sm text-text-secondary mb-2">
                Drag and drop files here, or click to browse
              </p>
              <p className="text-xs text-text-muted">
                Supports MP3, WAV, M4A, OGG, MP4, MOV
              </p>
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-primary">
              Files ({items.length})
            </h2>
            {selectedItems.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-text-secondary">
                  {selectedItems.size} selected
                </span>
                <Button variant="outline" size="sm" className="focus-ring">
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Retry
                </Button>
                <Button variant="outline" size="sm" className="focus-ring">
                  <Trash2 className="w-3 h-3 mr-1" />
                  Remove
                </Button>
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            {items.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card 
                  className={cn(
                    "hover:bg-surface-alt/30 transition-colors cursor-pointer",
                    selectedItems.has(item.id) && "bg-surface-alt/50 ring-1 ring-primary"
                  )}
                  onClick={(e) => {
                    const newSelected = new Set(selectedItems);
                    if (e.ctrlKey || e.metaKey) {
                      if (newSelected.has(item.id)) {
                        newSelected.delete(item.id);
                      } else {
                        newSelected.add(item.id);
                      }
                    } else {
                      newSelected.clear();
                      newSelected.add(item.id);
                    }
                    setSelectedItems(newSelected);
                  }}
                  data-testid={`batch-item-${item.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* Status Icon */}
                      <div className="flex-shrink-0">
                        {getStatusIcon(item.status)}
                      </div>
                      
                      {/* File Icon & Name */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-gradient-surface flex items-center justify-center flex-shrink-0">
                          <FileAudio className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-text-primary truncate">
                            {item.fileName}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-text-secondary">
                            <span>{formatFileSize(item.fileSize)}</span>
                            <span>•</span>
                            <span>{item.duration}</span>
                            {item.confidence && (
                              <>
                                <span>•</span>
                                <span>Confidence: {item.confidence}%</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Progress & Status */}
                      <div className="flex items-center gap-4 flex-shrink-0">
                        {item.status === 'PROCESSING' && (
                          <div className="w-32">
                            <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
                              <span>{item.progress}%</span>
                              {item.eta && <span>ETA: {formatETA(item.eta)}</span>}
                            </div>
                            <Progress value={item.progress} className="h-1" />
                          </div>
                        )}
                        
                        {getStatusBadge(item.status)}
                        
                        <Button variant="ghost" size="sm" className="focus-ring">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Error Message */}
                    {item.status === 'ERROR' && item.errorMessage && (
                      <div className="mt-3 p-3 rounded-md bg-danger/10 border border-danger/20">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0" />
                          <p className="text-sm text-danger">{item.errorMessage}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="ml-auto text-danger border-danger hover:bg-danger hover:text-danger-foreground focus-ring"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRetry(item.id);
                            }}
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            Retry
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default BatchProcessor;