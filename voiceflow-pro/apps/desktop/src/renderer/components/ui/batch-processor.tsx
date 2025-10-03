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
} from 'lucide-react';
import React, { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';


interface BatchItem {
  id: string;
  fileName: string;
  fileSize: number;
  duration: string;
  status: 'pending' | 'processing' | 'completed' | 'error' | 'cancelled';
  progress: number;
  errorMessage?: string;
  eta?: string;
  confidence?: number;
}

interface BatchJob {
  id: string;
  name: string;
  status: 'draft' | 'running' | 'paused' | 'completed' | 'error';
  createdAt: string;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  concurrency: number;
  estimatedTimeRemaining?: string;
  throughputMbps?: number;
}

interface BatchProcessorProps {
  className?: string;
  job?: BatchJob;
  items?: BatchItem[];
  onStart?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onRetry?: (itemId: string) => void;
  onRemove?: (itemId: string) => void;
  onAddFiles?: () => void;
}

const mockJob: BatchJob = {
  id: '1',
  name: 'Podcast Episodes - Season 2',
  status: 'running',
  createdAt: '2024-03-15T10:30:00Z',
  totalItems: 12,
  completedItems: 7,
  failedItems: 1,
  concurrency: 3,
  estimatedTimeRemaining: '23 minutes',
  throughputMbps: 2.4,
};

const mockItems: BatchItem[] = [
  {
    id: '1',
    fileName: 'episode-001-intro.mp3',
    fileSize: 45600000,
    duration: '23:45',
    status: 'completed',
    progress: 100,
    confidence: 96,
  },
  {
    id: '2',
    fileName: 'episode-002-interview.mp3',
    fileSize: 89200000,
    duration: '45:22',
    status: 'processing',
    progress: 67,
    eta: '5 minutes',
  },
  {
    id: '3',
    fileName: 'episode-003-panel.mp3',
    fileSize: 72800000,
    duration: '37:18',
    status: 'error',
    progress: 0,
    errorMessage: 'Unsupported audio format',
  },
  {
    id: '4',
    fileName: 'episode-004-solo.mp3',
    fileSize: 56300000,
    duration: '28:54',
    status: 'pending',
    progress: 0,
  },
  {
    id: '5',
    fileName: 'episode-005-qa.mp3',
    fileSize: 64100000,
    duration: '32:17',
    status: 'pending',
    progress: 0,
  },
];

export const BatchProcessor: React.FC<BatchProcessorProps> = ({
  className,
  job = mockJob,
  items = mockItems,
  onStart,
  onPause,
  onStop,
  onRetry,
  onRemove,
  onAddFiles,
}) => {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusIcon = (status: BatchItem['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'processing':
        return <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-danger" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-text-muted" />;
      case 'cancelled':
        return <Square className="w-4 h-4 text-text-muted" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: BatchItem['status']) => {
    const variants = {
      completed: { label: 'Complete', className: 'text-success border-success' },
      processing: { label: 'Processing', className: 'text-primary border-primary animate-pulse' },
      error: { label: 'Error', className: 'text-danger border-danger' },
      pending: { label: 'Pending', className: 'text-text-muted border-text-muted' },
      cancelled: { label: 'Cancelled', className: 'text-text-muted border-text-muted' },
    };
    
    const variant = variants[status];
    return (
      <Badge variant="outline" className={cn('text-xs', variant.className)}>
        {variant.label}
      </Badge>
    );
  };

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
          <Button variant="outline" onClick={onAddFiles} className="focus-ring">
            <Upload className="w-4 h-4 mr-2" />
            Add Files
          </Button>
          <Button variant="outline" className="focus-ring">
            <Settings2 className="w-4 h-4 mr-2" />
            Settings
          </Button>
          <Separator orientation="vertical" className="h-6" />
          
          {job.status === 'running' ? (
            <>
              <Button variant="outline" onClick={onPause} className="focus-ring">
                <Pause className="w-4 h-4 mr-2" />
                Pause
              </Button>
              <Button variant="outline" onClick={onStop} className="focus-ring">
                <Square className="w-4 h-4 mr-2" />
                Stop
              </Button>
            </>
          ) : (
            <Button onClick={onStart} className="bg-gradient-primary hover:opacity-90 focus-ring">
              <Play className="w-4 h-4 mr-2" />
              Start Batch
            </Button>
          )}
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
                    {job.estimatedTimeRemaining || '--'}
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
                        {item.status === 'processing' && (
                          <div className="w-32">
                            <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
                              <span>{item.progress}%</span>
                              {item.eta && <span>ETA: {item.eta}</span>}
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
                    {item.status === 'error' && item.errorMessage && (
                      <div className="mt-3 p-3 rounded-md bg-danger/10 border border-danger/20">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0" />
                          <p className="text-sm text-danger">{item.errorMessage}</p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="ml-auto text-danger border-danger hover:bg-danger hover:text-danger-foreground focus-ring"
                            onClick={() => onRetry?.(item.id)}
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