import React, { useEffect, useState } from 'react';
import { useTranscriptStore } from '../../stores/transcriptStore';
import { Transcript } from '../../types/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '../ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { 
  Search, 
  MoreHorizontal, 
  Play, 
  Download, 
  Trash2, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Filter,
  RefreshCw,
  SortAsc,
  SortDesc,
  Eye
} from 'lucide-react';

interface TranscriptListProps {
  onTranscriptSelect?: (transcript: Transcript) => void;
  onTranscriptView?: (transcriptId: string) => void;
  selectedTranscriptId?: string;
  compact?: boolean;
}

type SortField = 'createdAt' | 'title' | 'duration';
type SortOrder = 'asc' | 'desc';

export function TranscriptList({ 
  onTranscriptSelect, 
  onTranscriptView,
  selectedTranscriptId,
  compact = false 
}: TranscriptListProps) {
  const { 
    transcripts, 
    pagination,
    fetchTranscripts, 
    deleteTranscript, 
    retryTranscription,
    isLoading, 
    error 
  } = useTranscriptStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<Transcript['status'] | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transcriptToDelete, setTranscriptToDelete] = useState<Transcript | null>(null);

  useEffect(() => {
    fetchTranscripts(1, 20, statusFilter === 'all' ? undefined : statusFilter);
  }, [fetchTranscripts, statusFilter]);

  const handleDelete = async () => {
    if (!transcriptToDelete) return;
    
    try {
      await deleteTranscript(transcriptToDelete.id);
      setDeleteDialogOpen(false);
      setTranscriptToDelete(null);
    } catch (error) {
      console.error('Failed to delete transcript:', error);
    }
  };

  const handleRetry = async (transcriptId: string) => {
    try {
      await retryTranscription(transcriptId);
    } catch (error) {
      console.error('Failed to retry transcription:', error);
    }
  };

  const exportTranscript = (transcript: Transcript) => {
    if (!transcript.segments || transcript.segments.length === 0) return;

    const text = transcript.segments
      .map(segment => `[${formatTime(segment.startTime)}] ${segment.text}`)
      .join('\n\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${transcript.title}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const getStatusColor = (status: Transcript['status']) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'PROCESSING':
        return 'bg-blue-100 text-blue-800';
      case 'QUEUED':
        return 'bg-yellow-100 text-yellow-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: Transcript['status']) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 className="h-3 w-3" />;
      case 'PROCESSING':
        return <Loader2 className="h-3 w-3 animate-spin" />;
      case 'QUEUED':
        return <Clock className="h-3 w-3" />;
      case 'FAILED':
        return <AlertCircle className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  // Filter and sort transcripts
  const filteredTranscripts = transcripts
    .filter(transcript => {
      const matchesSearch = transcript.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || transcript.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'duration':
          aValue = a.duration;
          bValue = b.duration;
          break;
        case 'createdAt':
        default:
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  if (compact) {
    return (
      <div className="space-y-3">
        {/* Compact Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search transcripts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Compact List */}
        <div className="space-y-2">
          {filteredTranscripts.map((transcript) => (
            <div
              key={transcript.id}
              className={`
                p-3 rounded-lg border cursor-pointer transition-colors
                ${selectedTranscriptId === transcript.id 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300'
                }
              `}
              onClick={() => onTranscriptSelect?.(transcript)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{transcript.title}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge className={`${getStatusColor(transcript.status)} text-xs`}>
                      <div className="flex items-center space-x-1">
                        {getStatusIcon(transcript.status)}
                        <span>{transcript.status}</span>
                      </div>
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {formatDate(transcript.createdAt)}
                    </span>
                  </div>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onTranscriptView?.(transcript.id)}>
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </DropdownMenuItem>
                    {transcript.status === 'COMPLETED' && (
                      <DropdownMenuItem onClick={() => exportTranscript(transcript)}>
                        <Download className="mr-2 h-4 w-4" />
                        Export
                      </DropdownMenuItem>
                    )}
                    {transcript.status === 'FAILED' && (
                      <DropdownMenuItem onClick={() => handleRetry(transcript.id)}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Retry
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => {
                        setTranscriptToDelete(transcript);
                        setDeleteDialogOpen(true);
                      }}
                      className="text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Transcripts</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchTranscripts()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filter */}
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search transcripts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Filter className="h-4 w-4 mr-2" />
                  Status: {statusFilter === 'all' ? 'All' : statusFilter}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setStatusFilter('all')}>
                  All Statuses
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('COMPLETED')}>
                  Completed
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('PROCESSING')}>
                  Processing
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('QUEUED')}>
                  Queued
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('FAILED')}>
                  Failed
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Sort Controls */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Sort by:</span>
            {(['createdAt', 'title', 'duration'] as SortField[]).map((field) => (
              <Button
                key={field}
                variant={sortField === field ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleSort(field)}
              >
                {field === 'createdAt' ? 'Date' : field === 'title' ? 'Title' : 'Duration'}
                {sortField === field && (
                  sortOrder === 'asc' ? 
                    <SortAsc className="h-3 w-3 ml-1" /> : 
                    <SortDesc className="h-3 w-3 ml-1" />
                )}
              </Button>
            ))}
          </div>

          {/* Results Summary */}
          <div className="text-sm text-gray-600">
            {filteredTranscripts.length} of {transcripts.length} transcripts
          </div>
        </CardContent>
      </Card>

      {/* Transcript Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTranscripts.map((transcript) => (
            <Card 
              key={transcript.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedTranscriptId === transcript.id ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => onTranscriptSelect?.(transcript)}
            >
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold truncate pr-2">{transcript.title}</h3>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onTranscriptView?.(transcript.id)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </DropdownMenuItem>
                        {transcript.status === 'COMPLETED' && (
                          <DropdownMenuItem onClick={() => exportTranscript(transcript)}>
                            <Download className="mr-2 h-4 w-4" />
                            Export
                          </DropdownMenuItem>
                        )}
                        {transcript.status === 'FAILED' && (
                          <DropdownMenuItem onClick={() => handleRetry(transcript.id)}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Retry
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => {
                            setTranscriptToDelete(transcript);
                            setDeleteDialogOpen(true);
                          }}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Badge className={getStatusColor(transcript.status)}>
                      <div className="flex items-center space-x-1">
                        {getStatusIcon(transcript.status)}
                        <span>{transcript.status}</span>
                      </div>
                    </Badge>
                  </div>
                  
                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex items-center justify-between">
                      <span>Duration:</span>
                      <span>{formatDuration(transcript.duration)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Language:</span>
                      <span>{transcript.language.toUpperCase()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Created:</span>
                      <span>{formatDate(transcript.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredTranscripts.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <div className="space-y-4">
              <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                <Search className="h-8 w-8 text-gray-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">No transcripts found</h3>
                <p className="text-gray-600 mt-1">
                  {searchTerm || statusFilter !== 'all' 
                    ? 'Try adjusting your search or filter criteria'
                    : 'Upload your first audio file to get started'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transcript</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{transcriptToDelete?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}