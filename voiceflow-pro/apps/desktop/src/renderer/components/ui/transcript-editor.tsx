import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Save,
  Download,
  Share,
  Wand2,
  BookOpen,
  ListChecks,
  Settings2,
  Edit3,
  MessageSquare,
  Star,
  Clock,
  User,
  Search,
  Loader2,
} from 'lucide-react';
import React, { useState, useRef, useCallback, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { apiClient } from '../../services/apiClient';
import type { Transcript } from '../../types/api';


interface Segment {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  speakerId?: string;
  confidence: number;
  isSelected?: boolean;
  isEditing?: boolean;
}

interface Speaker {
  id: string;
  label: string;
  color: string;
  segmentCount: number;
}

interface TranscriptEditorProps {
  className?: string;
  transcript?: Transcript | null;
  segments?: Segment[];
  speakers?: Speaker[];
  currentTime?: number;
  duration?: number;
  isPlaying?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onSeek?: (time: number) => void;
  onSegmentEdit?: (segmentId: string, text: string) => void;
  onSpeakerAssign?: (segmentId: string, speakerId: string) => void;
}

const mockSpeakers: Speaker[] = [
  { id: 'speaker-1', label: 'John Smith', color: '#3B82F6', segmentCount: 47 },
  { id: 'speaker-2', label: 'Sarah Johnson', color: '#10B981', segmentCount: 32 },
  { id: 'speaker-3', label: 'Mike Chen', color: '#F59E0B', segmentCount: 18 },
];

const mockSegments: Segment[] = [
  {
    id: '1',
    startMs: 0,
    endMs: 3500,
    text: "Welcome everyone to today's product strategy meeting. I'm excited to discuss our roadmap for the next quarter.",
    speakerId: 'speaker-1',
    confidence: 0.96,
  },
  {
    id: '2',
    startMs: 3500,
    endMs: 8200,
    text: "Thank you John. I've been analyzing the user feedback from our recent feature releases, and there are some interesting patterns emerging.",
    speakerId: 'speaker-2',
    confidence: 0.94,
  },
  {
    id: '3',
    startMs: 8200,
    endMs: 12800,
    text: "That's great Sarah. From the engineering perspective, we've been able to reduce processing time by 30% with the new algorithms.",
    speakerId: 'speaker-3',
    confidence: 0.98,
  },
  {
    id: '4',
    startMs: 12800,
    endMs: 18500,
    text: "Excellent progress Mike. Now, let's dive into the specific features we want to prioritize. I think AI-powered summaries should be at the top of our list.",
    speakerId: 'speaker-1',
    confidence: 0.95,
  },
];

export const TranscriptEditor: React.FC<TranscriptEditorProps> = ({
  className,
  transcript,
  segments: propSegments,
  speakers: propSpeakers,
  currentTime: propCurrentTime,
  duration: propDuration,
  isPlaying: propIsPlaying,
  onPlay,
  onPause,
  onSeek,
  onSegmentEdit,
  onSpeakerAssign,
}) => {
  const [selectedSegments, setSelectedSegments] = useState<Set<string>>(new Set());
  const [editingSegment, setEditingSegment] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [volume, setVolume] = useState([0.8]);
  const [loading, setLoading] = useState(false);
  const [fullTranscript, setFullTranscript] = useState<Transcript | null>(null);
  const [mappedSegments, setMappedSegments] = useState<Segment[]>(mockSegments);
  const [mappedSpeakers, setMappedSpeakers] = useState<Speaker[]>(mockSpeakers);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [internalIsPlaying, setInternalIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getSpeakerById = (id: string) => mappedSpeakers.find(s => s.id === id);

  // Fetch full transcript with segments when transcript prop changes
  useEffect(() => {
    if (!transcript?.id) {
      setFullTranscript(null);
      setMappedSegments(mockSegments);
      setMappedSpeakers(mockSpeakers);
      return;
    }

    const fetchFullTranscript = async () => {
      setLoading(true);
      try {
        console.log('Fetching full transcript for:', transcript.id);
        const resp = await apiClient.getTranscript(transcript.id);
        // API may return { transcript: { ... } } — prefer the inner object when present
        const fullData = ((resp as any)?.transcript ?? resp) as Transcript;
        setFullTranscript(fullData);

        // Map segments from backend format to component format
        if (fullData.segments && fullData.segments.length > 0) {
          const segments: Segment[] = fullData.segments.map((seg, index) => ({
            id: seg.id || `seg-${index}`,
            startMs: (seg.startTime || 0) * 1000, // Convert seconds to ms
            endMs: (seg.endTime || 0) * 1000,
            text: (seg.text || '').trim(),
            speakerId: seg.speakerId || `SPEAKER_${index % 3 + 1}`,
            confidence: seg.confidence ?? 0.95,
          }));
          setMappedSegments(segments);

          // Extract unique speakers
          const speakerMap = new Map<string, { count: number; color: string }>();
          const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

          segments.forEach(seg => {
            if (seg.speakerId) {
              const existing = speakerMap.get(seg.speakerId);
              if (existing) {
                existing.count++;
              } else {
                speakerMap.set(seg.speakerId, {
                  count: 1,
                  color: colors[speakerMap.size % colors.length]
                });
              }
            }
          });

          const speakers: Speaker[] = Array.from(speakerMap.entries()).map(([id, data]) => ({
            id,
            label: id.replace('SPEAKER_', 'Speaker '),
            color: data.color,
            segmentCount: data.count,
          }));

          setMappedSpeakers(speakers);
        } else {
          // No segments yet (still processing)
          setMappedSegments([]);
          setMappedSpeakers([]);
        }

        // Get audio URL if available
        if (fullData.audioUrl) {
          // For now, use audioUrl directly. In production, get signed URL from backend
          setAudioUrl(fullData.audioUrl);
        }

      } catch (error) {
        console.error('Failed to fetch transcript:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFullTranscript();
  }, [transcript?.id]);

  // Setup audio player
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime * 1000); // Convert to ms
    };

    const handlePlay = () => setInternalIsPlaying(true);
    const handlePause = () => setInternalIsPlaying(false);
    const handleEnded = () => setInternalIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  // Handle play/pause
  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (internalIsPlaying) {
      audio.pause();
      onPause?.();
    } else {
      audio.play().catch(error => console.error('Failed to play audio:', error));
      onPlay?.();
    }
  }, [internalIsPlaying, onPlay, onPause]);

  // Handle seek
  const handleSeekInternal = useCallback((ms: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = ms / 1000; // Convert ms to seconds
    }
    onSeek?.(ms);
  }, [onSeek]);

  const handleSegmentClick = useCallback((segment: Segment) => {
    handleSeekInternal(segment.startMs);
  }, [handleSeekInternal]);

  const handleSegmentSelect = useCallback((segmentId: string, isCtrlClick: boolean = false) => {
    setSelectedSegments(prev => {
      const newSet = new Set(prev);
      if (isCtrlClick) {
        if (newSet.has(segmentId)) {
          newSet.delete(segmentId);
        } else {
          newSet.add(segmentId);
        }
      } else {
        newSet.clear();
        newSet.add(segmentId);
      }
      return newSet;
    });
  }, []);

  const getCurrentSegment = () => {
    return mappedSegments.find(segment =>
      currentTime >= segment.startMs && currentTime <= segment.endMs
    );
  };

  const currentSegment = getCurrentSegment();
  const duration = fullTranscript?.duration ? fullTranscript.duration * 1000 : 0; // Convert seconds to ms
  const isPlaying = propIsPlaying !== undefined ? propIsPlaying : internalIsPlaying;
  const segments = propSegments || mappedSegments;
  const speakers = propSpeakers || mappedSpeakers;

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {/* Hidden Audio Element */}
      <audio ref={audioRef} src={audioUrl || undefined} />

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2 text-text-secondary">Loading transcript...</span>
        </div>
      )}

      {/* Editor Header */}
      <header className="flex items-center justify-between p-4 border-b border-border bg-surface-alt/30">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-text-primary">
            {fullTranscript?.title || transcript?.title || 'Untitled Transcript'}
          </h1>
          <Badge
            variant="outline"
            className={cn(
              fullTranscript?.status === 'COMPLETED' && "text-success border-success",
              fullTranscript?.status === 'PROCESSING' && "text-warning border-warning",
              fullTranscript?.status === 'FAILED' && "text-error border-error",
              fullTranscript?.status === 'QUEUED' && "text-info border-info"
            )}
          >
            {fullTranscript?.status || transcript?.status || 'Unknown'}
          </Badge>
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <Clock className="w-4 h-4" />
            <span>{formatTime(duration)}</span>
            {segments.length > 0 && (
              <>
                <span>•</span>
                <span>{segments.length} segments</span>
              </>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="focus-ring">
            <Search className="w-4 h-4 mr-2" />
            Search
          </Button>
          <Button variant="outline" size="sm" className="focus-ring">
            <Wand2 className="w-4 h-4 mr-2" />
            AI Actions
          </Button>
          <Button variant="outline" size="sm" className="focus-ring">
            <BookOpen className="w-4 h-4 mr-2" />
            Summary
          </Button>
          <Button variant="outline" size="sm" className="focus-ring">
            <ListChecks className="w-4 h-4 mr-2" />
            Action Items
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button variant="outline" size="sm" className="focus-ring">
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
          <Button variant="outline" size="sm" className="focus-ring">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" className="focus-ring">
            <Share className="w-4 h-4 mr-2" />
            Share
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col">
          {/* Audio Controls */}
          <div className="p-4 border-b border-border bg-surface-alt/20">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePlayPause}
                  disabled={!audioUrl}
                  className="focus-ring"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!audioUrl}
                  onClick={() => handleSeekInternal(Math.max(0, currentTime - 10000))}
                  className="focus-ring"
                >
                  <SkipBack className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!audioUrl}
                  onClick={() => handleSeekInternal(Math.min(duration, currentTime + 10000))}
                  className="focus-ring"
                >
                  <SkipForward className="w-4 h-4" />
                </Button>
              </div>

              {/* Timeline */}
              <div className="flex-1 mx-4">
                <div className="flex items-center gap-2 text-sm text-text-secondary mb-2">
                  <span>{formatTime(currentTime)}</span>
                  <span>/</span>
                  <span>{formatTime(duration)}</span>
                </div>
                <Slider
                  value={[currentTime]}
                  max={duration || 100}
                  step={1000}
                  disabled={!audioUrl || duration === 0}
                  onValueChange={([value]) => handleSeekInternal(value)}
                  className="w-full"
                />
              </div>

              {/* Volume */}
              <div className="flex items-center gap-2 w-32">
                <Volume2 className="w-4 h-4 text-text-secondary" />
                <Slider
                  value={volume}
                  max={1}
                  step={0.1}
                  onValueChange={(value) => {
                    setVolume(value);
                    if (audioRef.current) {
                      audioRef.current.volume = value[0];
                    }
                  }}
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          {/* Transcript Content */}
          <ScrollArea ref={scrollAreaRef} className="flex-1">
            <div className="p-6 space-y-1">
              {segments.map((segment, index) => {
                const speaker = getSpeakerById(segment.speakerId || '');
                const isActive = currentSegment?.id === segment.id;
                const isSelected = selectedSegments.has(segment.id);

                return (
                  <motion.div
                    key={segment.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      "transcript-line group",
                      isActive && "active bg-primary/5 border-l-primary",
                      isSelected && "bg-surface-alt/50"
                    )}
                    onClick={(e) => {
                      handleSegmentClick(segment);
                      handleSegmentSelect(segment.id, e.ctrlKey || e.metaKey);
                    }}
                    data-testid={`segment-${segment.id}`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Timeline & Speaker */}
                      <div className="flex flex-col items-center gap-1 w-20 flex-shrink-0">
                        <span className="text-xs font-mono text-text-secondary">
                          {formatTime(segment.startMs)}
                        </span>
                        {speaker && (
                          <div className="speaker-label" style={{ backgroundColor: `${speaker.color}20`, color: speaker.color }}>
                            <User className="w-3 h-3 mr-1" />
                            {speaker.label.split(' ')[0]}
                          </div>
                        )}
                      </div>

                      {/* Segment Text */}
                      <div className="flex-1 min-w-0">
                        {editingSegment === segment.id ? (
                          <textarea
                            className="w-full p-2 rounded bg-surface border border-border focus:border-primary focus:outline-none resize-none"
                            value={segment.text}
                            onChange={(e) => onSegmentEdit?.(segment.id, e.target.value)}
                            onBlur={() => setEditingSegment(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                setEditingSegment(null);
                              }
                            }}
                            autoFocus
                            rows={Math.max(2, Math.ceil(segment.text.length / 80))}
                          />
                        ) : (
                          <p 
                            className="text-text-primary leading-relaxed cursor-pointer"
                            onDoubleClick={() => setEditingSegment(segment.id)}
                          >
                            {segment.text}
                          </p>
                        )}
                        
                        {/* Segment Metadata */}
                        <div className="flex items-center justify-between mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="flex items-center gap-2 text-xs text-text-secondary">
                            <span>Confidence: {Math.round(segment.confidence * 100)}%</span>
                            {segment.confidence < 0.9 && (
                              <Badge variant="outline" className="text-warning border-warning text-xs">
                                Low Confidence
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="w-6 h-6 p-0">
                              <Edit3 className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="w-6 h-6 p-0">
                              <MessageSquare className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="w-6 h-6 p-0">
                              <Star className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Right Panel - Speakers & AI Tools */}
        <div className="w-80 border-l border-border bg-surface-alt/20 flex flex-col">
          {/* Speakers Panel */}
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-text-primary mb-4">Speakers</h3>
            <div className="space-y-2">
              {speakers.map((speaker) => (
                <div key={speaker.id} className="flex items-center justify-between p-2 rounded hover:bg-surface-alt/50">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: speaker.color }}
                    />
                    <span className="text-sm font-medium text-text-primary">
                      {speaker.label}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {speaker.segmentCount}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* AI Tools Panel */}
          <div className="flex-1 p-4">
            <h3 className="font-semibold text-text-primary mb-4">AI Tools</h3>
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start focus-ring">
                <BookOpen className="w-4 h-4 mr-2" />
                Generate Summary
              </Button>
              <Button variant="outline" className="w-full justify-start focus-ring">
                <ListChecks className="w-4 h-4 mr-2" />
                Extract Action Items
              </Button>
              <Button variant="outline" className="w-full justify-start focus-ring">
                <Wand2 className="w-4 h-4 mr-2" />
                Create Chapters
              </Button>
              <Button variant="outline" className="w-full justify-start focus-ring">
                <Settings2 className="w-4 h-4 mr-2" />
                Custom Prompt
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranscriptEditor;