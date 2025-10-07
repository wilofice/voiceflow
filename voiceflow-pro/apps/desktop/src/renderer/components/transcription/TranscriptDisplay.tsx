import { 
  Play, 
  Pause, 
  Download, 
  Edit3, 
  Save, 
  X, 
  Clock, 
  User, 
  Volume2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import React, { useEffect, useState, useRef } from 'react';

import { useTranscriptStore } from '../../stores/transcriptStore';
import { Transcript, TranscriptSegment } from '../../types/api';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Textarea } from '../ui/textarea';

interface TranscriptDisplayProps {
  transcriptId: string;
  showAudioPlayer?: boolean;
  editable?: boolean;
}

interface EditingSegment {
  id: string;
  text: string;
}

export function TranscriptDisplay({ 
  transcriptId, 
  showAudioPlayer = true, 
  editable = true 
}: TranscriptDisplayProps) {
  const { 
    currentTranscript, 
    fetchTranscript, 
    updateTranscript, 
    subscribeToTranscript, 
    unsubscribeFromTranscript,
    isLoading, 
    error 
  } = useTranscriptStore();

  const [editingSegment, setEditingSegment] = useState<EditingSegment | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const segmentRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    // Fetch transcript and subscribe to real-time updates
    fetchTranscript(transcriptId);
    subscribeToTranscript(transcriptId);

    return () => {
      unsubscribeFromTranscript(transcriptId);
    };
  }, [transcriptId, fetchTranscript, subscribeToTranscript, unsubscribeFromTranscript]);

  const handleSegmentEdit = (segment: TranscriptSegment) => {
    setEditingSegment({
      id: segment.id,
      text: segment.text,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingSegment || !currentTranscript) return;

    try {
      await updateTranscript(currentTranscript.id, {
        segments: [{
          id: editingSegment.id,
          text: editingSegment.text,
        }],
      });
      setEditingSegment(null);
    } catch (error) {
      console.error('Failed to update segment:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingSegment(null);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const jumpToSegment = (startTime: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = startTime;
      
      // Scroll to segment
      const segmentElement = segmentRefs.current[`segment-${startTime}`];
      if (segmentElement) {
        segmentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
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
        return <CheckCircle2 className="h-4 w-4" />;
      case 'PROCESSING':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'QUEUED':
        return <Clock className="h-4 w-4" />;
      case 'FAILED':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const exportTranscript = () => {
    if (!currentTranscript) return;

    const text = currentTranscript.segments
      .map(segment => `[${formatTime(segment.startTime)}] ${segment.text}`)
      .join('\n\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentTranscript.title}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            <p className="text-gray-600">Loading transcript...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!currentTranscript) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Transcript not found</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Transcript Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="text-xl">{currentTranscript.title}</CardTitle>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <div className="flex items-center space-x-1">
                  <Clock className="h-4 w-4" />
                  <span>{formatDuration(currentTranscript.duration)}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Volume2 className="h-4 w-4" />
                  <span>{currentTranscript.language.toUpperCase()}</span>
                </div>
                <Badge className={getStatusColor(currentTranscript.status)}>
                  <div className="flex items-center space-x-1">
                    {getStatusIcon(currentTranscript.status)}
                    <span>{currentTranscript.status}</span>
                  </div>
                </Badge>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {currentTranscript.status === 'COMPLETED' && (
                <Button variant="outline" size="sm" onClick={exportTranscript}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {/* Audio Player */}
        {showAudioPlayer && currentTranscript.audioUrl && currentTranscript.status === 'COMPLETED' && (
          <CardContent className="pt-0">
            <div className="space-y-4">
              <audio
                ref={audioRef}
                src={currentTranscript.audioUrl}
                onTimeUpdate={handleTimeUpdate}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                className="hidden"
              />
              
              <div className="flex items-center space-x-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePlayPause}
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatDuration(currentTranscript.duration)}</span>
                  </div>
                  <Progress 
                    value={(currentTime / currentTranscript.duration) * 100} 
                    className="h-2"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Processing Status */}
      {currentTranscript.status === 'PROCESSING' && (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription>
            Your transcript is being processed. This may take a few minutes depending on the file size.
          </AlertDescription>
        </Alert>
      )}

      {currentTranscript.status === 'QUEUED' && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertDescription>
            Your transcript is in the processing queue. It will be processed shortly.
          </AlertDescription>
        </Alert>
      )}

      {currentTranscript.status === 'FAILED' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Transcription failed. Please try uploading the file again or contact support if the problem persists.
          </AlertDescription>
        </Alert>
      )}

      {/* Transcript Segments */}
      {currentTranscript.segments && currentTranscript.segments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Transcript</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {currentTranscript.segments.map((segment, index) => {
                const isCurrentSegment = 
                  currentTime >= segment.startTime && 
                  currentTime < segment.endTime;
                
                const isEditing = editingSegment?.id === segment.id;

                return (
                  <div
                    key={segment.id}
                    ref={(el) => segmentRefs.current[`segment-${segment.startTime}`] = el}
                    className={`
                      p-4 rounded-lg border transition-all duration-200 cursor-pointer
                      ${isCurrentSegment 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                    onClick={() => jumpToSegment(segment.startTime)}
                  >
                    <div className="flex items-start justify-between space-x-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center space-x-3 text-sm text-gray-600">
                          <span className="font-medium">
                            {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
                          </span>
                          {segment.speaker && (
                            <div className="flex items-center space-x-1">
                              <User className="h-3 w-3" />
                              <span>{segment.speaker}</span>
                            </div>
                          )}
                          {segment.confidence && (
                            <span className="text-xs">
                              {Math.round(segment.confidence * 100)}% confidence
                            </span>
                          )}
                        </div>
                        
                        {isEditing ? (
                          <div className="space-y-3">
                            <Textarea
                              value={editingSegment.text}
                              onChange={(e) => setEditingSegment({
                                ...editingSegment,
                                text: e.target.value,
                              })}
                              className="min-h-[100px]"
                              autoFocus
                            />
                            <div className="flex items-center space-x-2">
                              <Button size="sm" onClick={handleSaveEdit}>
                                <Save className="h-3 w-3 mr-1" />
                                Save
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={handleCancelEdit}
                              >
                                <X className="h-3 w-3 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-gray-900 leading-relaxed">
                            {segment.text}
                          </p>
                        )}
                      </div>
                      
                      {editable && !isEditing && currentTranscript.status === 'COMPLETED' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSegmentEdit(segment);
                          }}
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {currentTranscript.status === 'COMPLETED' && 
       (!currentTranscript.segments || currentTranscript.segments.length === 0) && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No transcript segments found. The audio file may not contain any speech.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}