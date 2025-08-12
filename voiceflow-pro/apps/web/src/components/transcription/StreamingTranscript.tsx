"use client";

import { useState, useRef, useEffect } from 'react';
import { TranscriptionSegment } from '@/lib/whisper/whisperEngine';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Copy,
  Download,
  Search,
  Filter,
  Clock,
  MessageSquare,
  Type,
  Mic,
  Volume2,
  VolumeX
} from 'lucide-react';

export interface StreamingTranscriptProps {
  segments: TranscriptionSegment[];
  currentSegment?: string;
  isRecording?: boolean;
  isProcessing?: boolean;
  onSegmentClick?: (segment: TranscriptionSegment) => void;
  onCopyTranscript?: () => void;
  onExportTranscript?: () => void;
  className?: string;
}

interface TranscriptDisplayProps {
  segments: TranscriptionSegment[];
  currentSegment?: string;
  isRecording?: boolean;
  isProcessing?: boolean;
  view: 'segments' | 'continuous' | 'timestamps';
  onSegmentClick?: (segment: TranscriptionSegment) => void;
}

function TranscriptDisplay({
  segments,
  currentSegment,
  isRecording,
  isProcessing,
  view,
  onSegmentClick
}: TranscriptDisplayProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new segments are added
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [segments, currentSegment, autoScroll]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
      setAutoScroll(isAtBottom);
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const renderSegmentedView = () => (
    <div className="space-y-2">
      {segments.map((segment, index) => (
        <div
          key={index}
          className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer group"
          onClick={() => onSegmentClick?.(segment)}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1 text-sm leading-relaxed">
              {segment.text}
            </div>
            <div className="flex items-center space-x-2 ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-xs text-gray-500">
                {formatTime(segment.start)}
              </span>
              <Volume2 className="w-3 h-3 text-gray-400" />
            </div>
          </div>
          {segment.confidence && (
            <div className="mt-1">
              <div className="flex items-center space-x-2">
                <div className="flex-1 bg-gray-200 rounded-full h-1">
                  <div
                    className={`h-1 rounded-full ${
                      segment.confidence > 0.8
                        ? 'bg-green-500'
                        : segment.confidence > 0.6
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${segment.confidence * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400">
                  {Math.round(segment.confidence * 100)}%
                </span>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const renderContinuousView = () => (
    <div className="prose prose-sm max-w-none">
      <p className="text-sm leading-relaxed whitespace-pre-wrap">
        {segments.map(segment => segment.text).join(' ')}
        {currentSegment && isRecording && (
          <span className="text-blue-600 italic"> {currentSegment}</span>
        )}
      </p>
    </div>
  );

  const renderTimestampView = () => (
    <div className="space-y-1">
      {segments.map((segment, index) => (
        <div
          key={index}
          className="flex items-start space-x-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
          onClick={() => onSegmentClick?.(segment)}
        >
          <div className="flex-shrink-0 w-16">
            <Badge variant="outline" className="text-xs">
              {formatTime(segment.start)}
            </Badge>
          </div>
          <div className="flex-1 text-sm">
            {segment.text}
          </div>
        </div>
      ))}
    </div>
  );

  const renderCurrentSegment = () => {
    if (!currentSegment || !isRecording) return null;
    
    return (
      <div className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
        <div className="flex justify-between items-start">
          <div className="flex-1 text-sm italic text-blue-800">
            {currentSegment}
          </div>
          <Badge variant="secondary" className="text-xs">
            {isProcessing ? 'Processing...' : 'Live'}
          </Badge>
        </div>
      </div>
    );
  };

  return (
    <div
      ref={scrollRef}
      className="max-h-80 overflow-y-auto space-y-3"
      onScroll={handleScroll}
    >
      {view === 'segments' && renderSegmentedView()}
      {view === 'continuous' && renderContinuousView()}
      {view === 'timestamps' && renderTimestampView()}
      {renderCurrentSegment()}
      
      {segments.length === 0 && !currentSegment && (
        <div className="text-center py-12 text-gray-500">
          <Mic className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium mb-1">No transcript yet</p>
          <p className="text-xs">Start recording to see your transcript appear here</p>
        </div>
      )}
    </div>
  );
}

export function StreamingTranscript({
  segments,
  currentSegment,
  isRecording = false,
  isProcessing = false,
  onSegmentClick,
  onCopyTranscript,
  onExportTranscript,
  className = ''
}: StreamingTranscriptProps) {
  const [view, setView] = useState<'segments' | 'continuous' | 'timestamps'>('segments');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredSegments, setFilteredSegments] = useState<TranscriptionSegment[]>(segments);

  // Filter segments based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredSegments(segments);
    } else {
      const filtered = segments.filter(segment =>
        segment.text.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredSegments(filtered);
    }
  }, [segments, searchQuery]);

  const handleCopy = () => {
    const text = segments.map(s => s.text).join(' ');
    navigator.clipboard.writeText(text);
    onCopyTranscript?.();
  };

  const handleExport = () => {
    const data = {
      transcript: segments.map(s => s.text).join(' '),
      segments: segments.map(s => ({
        text: s.text,
        start: s.start,
        end: s.end,
        confidence: s.confidence
      })),
      exported_at: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    onExportTranscript?.();
  };

  const totalDuration = segments.length > 0 ? Math.max(...segments.map(s => s.end || s.start)) : 0;
  const wordCount = segments.reduce((count, segment) => count + segment.text.split(' ').length, 0);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center space-x-2">
            <MessageSquare className="w-4 h-4" />
            <span>Live Transcript</span>
            {isRecording && (
              <Badge variant="default" className="text-xs animate-pulse">
                Recording
              </Badge>
            )}
          </CardTitle>
          
          <div className="flex items-center space-x-2">
            {segments.length > 0 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="h-8 px-2"
                >
                  <Copy className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExport}
                  className="h-8 px-2"
                >
                  <Download className="w-3 h-3" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        {segments.length > 0 && (
          <div className="flex items-center space-x-4 text-xs text-gray-500">
            <div className="flex items-center space-x-1">
              <MessageSquare className="w-3 h-3" />
              <span>{segments.length} segment{segments.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Type className="w-3 h-3" />
              <span>{wordCount} words</span>
            </div>
            <div className="flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>{Math.round(totalDuration)}s</span>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {segments.length > 0 && (
          <>
            {/* Search and View Controls */}
            <div className="flex items-center justify-between space-x-2">
              <div className="flex-1 relative">
                <Search className="absolute left-2 top-2.5 w-3 h-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search transcript..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 text-xs border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <Tabs value={view} onValueChange={(v) => setView(v as any)} className="flex-shrink-0">
                <TabsList className="h-8">
                  <TabsTrigger value="segments" className="text-xs px-2">
                    Segments
                  </TabsTrigger>
                  <TabsTrigger value="continuous" className="text-xs px-2">
                    Text
                  </TabsTrigger>
                  <TabsTrigger value="timestamps" className="text-xs px-2">
                    Timeline
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <Separator />
          </>
        )}

        {/* Transcript Display */}
        <TranscriptDisplay
          segments={filteredSegments}
          currentSegment={currentSegment}
          isRecording={isRecording}
          isProcessing={isProcessing}
          view={view}
          onSegmentClick={onSegmentClick}
        />

        {/* Search Results Info */}
        {searchQuery.trim() && filteredSegments.length !== segments.length && (
          <div className="text-center">
            <Badge variant="outline" className="text-xs">
              {filteredSegments.length} of {segments.length} segments match "{searchQuery}"
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}