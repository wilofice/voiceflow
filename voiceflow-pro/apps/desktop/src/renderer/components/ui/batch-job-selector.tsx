import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Pause,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useBatchStore } from '@/stores/batchStore';
import { BatchJob, BatchJobStatus } from '@/types/api';

interface BatchJobSelectorProps {
  selectedJobId: string | null;
  onJobSelect: (jobId: string | null) => void;
}

export const BatchJobSelector: React.FC<BatchJobSelectorProps> = ({
  selectedJobId,
  onJobSelect,
}) => {
  const {
    jobsList,
    fetchJobs,
    createJob,
    deleteJob,
    isLoading,
    isCreating,
  } = useBatchStore();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newJobName, setNewJobName] = useState('');
  const [newJobConcurrency, setNewJobConcurrency] = useState('3');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Fetch jobs on mount
  useEffect(() => {
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps = run once on mount only

  const handleCreateJob = async () => {
    if (!newJobName.trim()) return;

    try {
      const job = await createJob({
        name: newJobName.trim(),
        concurrency: parseInt(newJobConcurrency),
      });

      setIsCreateDialogOpen(false);
      setNewJobName('');
      setNewJobConcurrency('3');

      // Auto-select the newly created job
      onJobSelect(job.id);
    } catch (error) {
      console.error('Failed to create job:', error);
    }
  };

  const handleDeleteJob = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent job selection

    if (deleteConfirm === jobId) {
      try {
        await deleteJob(jobId);
        if (selectedJobId === jobId) {
          onJobSelect(null);
        }
        setDeleteConfirm(null);
      } catch (error) {
        console.error('Failed to delete job:', error);
      }
    } else {
      setDeleteConfirm(jobId);
      // Reset confirmation after 3 seconds
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const getStatusIcon = (status: BatchJobStatus) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'RUNNING':
        return <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />;
      case 'PAUSED':
        return <Pause className="w-4 h-4 text-warning" />;
      case 'ERROR':
        return <XCircle className="w-4 h-4 text-danger" />;
      case 'DRAFT':
        return <Clock className="w-4 h-4 text-text-muted" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: BatchJobStatus) => {
    const variants = {
      COMPLETED: { label: 'Completed', className: 'text-success border-success' },
      RUNNING: { label: 'Running', className: 'text-primary border-primary' },
      PAUSED: { label: 'Paused', className: 'text-warning border-warning' },
      ERROR: { label: 'Error', className: 'text-danger border-danger' },
      DRAFT: { label: 'Draft', className: 'text-text-muted border-text-muted' },
    };

    const variant = variants[status];
    return (
      <Badge variant="outline" className={cn('text-xs', variant.className)}>
        {variant.label}
      </Badge>
    );
  };

  const canDeleteJob = (job: BatchJob) => {
    return job.status === 'DRAFT' || job.status === 'COMPLETED' || job.status === 'ERROR';
  };

  const filteredJobs = jobsList.filter(job => {
    if (statusFilter === 'all') return true;
    return job.status === statusFilter;
  });

  const getProgress = (job: BatchJob) => {
    if (job.totalItems === 0) return 0;
    return (job.completedItems / job.totalItems) * 100;
  };

  return (
    <div className="flex flex-col h-full bg-surface rounded-lg border border-border">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-text-primary">Batch Jobs</h2>
          <Button
            size="sm"
            onClick={() => setIsCreateDialogOpen(true)}
            className="bg-gradient-primary hover:opacity-90"
          >
            <Plus className="w-4 h-4 mr-1" />
            New
          </Button>
        </div>

        {/* Filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Jobs</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="RUNNING">Running</SelectItem>
            <SelectItem value="PAUSED">Paused</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="ERROR">Error</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Jobs List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {isLoading && jobsList.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-text-muted" />
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertTriangle className="w-8 h-8 text-text-muted mb-2" />
              <p className="text-sm text-text-muted">
                {statusFilter === 'all' ? 'No batch jobs yet' : `No ${statusFilter.toLowerCase()} jobs`}
              </p>
              {statusFilter === 'all' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="mt-3"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Create First Job
                </Button>
              )}
            </div>
          ) : (
            <AnimatePresence>
              {filteredJobs.map((job, index) => {
                const progress = getProgress(job);
                const isSelected = selectedJobId === job.id;

                return (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card
                      className={cn(
                        'cursor-pointer transition-all hover:bg-surface-alt/50',
                        isSelected && 'bg-surface-alt ring-2 ring-primary'
                      )}
                      onClick={() => onJobSelect(job.id)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {getStatusIcon(job.status)}
                            <h3 className="font-medium text-sm text-text-primary truncate">
                              {job.name}
                            </h3>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                            {getStatusBadge(job.status)}
                            {canDeleteJob(job) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className={cn(
                                  'h-6 w-6 p-0',
                                  deleteConfirm === job.id && 'text-danger bg-danger/10'
                                )}
                                onClick={(e) => handleDeleteJob(job.id, e)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Progress Info */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-text-secondary">
                            <span>
                              {job.completedItems}/{job.totalItems} items
                            </span>
                            {job.status === 'RUNNING' && job.estimatedTimeRemaining && (
                              <span className="text-primary">
                                ETA: {formatETA(job.estimatedTimeRemaining)}
                              </span>
                            )}
                          </div>

                          {job.totalItems > 0 && (
                            <Progress value={progress} className="h-1" />
                          )}

                          {job.failedItems > 0 && (
                            <p className="text-xs text-danger">
                              {job.failedItems} failed
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </ScrollArea>

      {/* Create Job Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Batch Job</DialogTitle>
            <DialogDescription>
              Create a new batch transcription job. You can add files after creation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="job-name">Job Name *</Label>
              <Input
                id="job-name"
                placeholder="e.g., Podcast Episodes - Season 2"
                value={newJobName}
                onChange={(e) => setNewJobName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newJobName.trim()) {
                    handleCreateJob();
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="concurrency">
                Concurrency
                <span className="text-xs text-text-muted ml-2">
                  (How many files to process at once)
                </span>
              </Label>
              <Select value={newJobConcurrency} onValueChange={setNewJobConcurrency}>
                <SelectTrigger id="concurrency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                    <SelectItem key={num} value={num.toString()}>
                      {num} {num === 1 ? 'file' : 'files'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setNewJobName('');
                setNewJobConcurrency('3');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateJob}
              disabled={!newJobName.trim() || isCreating}
              className="bg-gradient-primary"
            >
              {isCreating ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Job'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Helper function
function formatETA(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.ceil((seconds % 3600) / 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
