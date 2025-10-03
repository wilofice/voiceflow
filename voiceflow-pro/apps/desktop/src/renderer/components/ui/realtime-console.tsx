import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mic, 
  MicOff,
  Play,
  Pause,
  Square,
  Bookmark,
  Settings2,
  Volume2,
  Signal,
  Clock,
  User,
} from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { WaveformVisualizer } from '@/components/ui/waveform-visualizer';
import { cn } from '@/lib/utils';


interface Caption {
  id: string;
  text: string;
  startMs: number;
  speaker?: string;
  confidence: number;
  isFinal: boolean;
}

interface RealtimeSessionConfig {
  language: string;
  model: string;
  enableDiarization: boolean;
  confidenceThreshold: number;
}

interface RealtimeConsoleProps {
  className?: string;
  isRecording?: boolean;
  isPaused?: boolean;
  sessionDuration?: number;
  captions?: Caption[];
  latencyMs?: number;
  confidenceScore?: number;
  onStart?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onMarker?: (timestamp: number) => void;
  onConfigChange?: (config: RealtimeSessionConfig) => void;
}

const mockCaptions: Caption[] = [
  {
    id: '1',
    text: "Welcome everyone to today's product strategy meeting.",
    startMs: 1000,
    speaker: 'John',
    confidence: 0.96,
    isFinal: true,
  },
  {
    id: '2', 
    text: "I'm excited to discuss our roadmap for the next quarter.",
    startMs: 4500,
    speaker: 'John',
    confidence: 0.94,
    isFinal: true,
  },
  {
    id: '3',
    text: "Thank you John. I've been analyzing the user feedback...",
    startMs: 8200,
    speaker: 'Sarah',
    confidence: 0.92,
    isFinal: false,
  },
];

export const RealtimeConsole: React.FC<RealtimeConsoleProps> = ({
  className,
  isRecording = false,
  isPaused = false,
  sessionDuration = 0,
  captions = mockCaptions,
  latencyMs = 320,
  confidenceScore = 0.94,
  onStart,
  onPause,
  onStop,
  onMarker,
}) => {
  const [volume, setVolume] = useState([0.75]);
  const [fontSize, setFontSize] = useState([16]);
  const captionsEndRef = useRef<HTMLDivElement>(null);

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getLatencyColor = (latency: number) => {
    if (latency < 300) return 'text-success';
    if (latency < 500) return 'text-warning';
    return 'text-danger';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence > 0.9) return 'text-success';
    if (confidence > 0.75) return 'text-warning';
    return 'text-danger';
  };

  const addMarker = () => {
    onMarker?.(sessionDuration);
  };

  // Auto-scroll captions
  useEffect(() => {
    captionsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [captions]);

  const activeCaptions = captions.filter(caption => 
    sessionDuration >= caption.startMs && sessionDuration <= caption.startMs + 5000
  );

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {/* Header with Controls */}
      <header className="flex items-center justify-between p-6 border-b border-border bg-surface-alt/20">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-1">
            Live Transcription
          </h1>
          <div className="flex items-center gap-4 text-sm text-text-secondary">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>{formatDuration(sessionDuration)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Signal className="w-4 h-4" />
              <span className={getLatencyColor(latencyMs)}>
                {latencyMs}ms latency
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={getConfidenceColor(confidenceScore)}>
                {Math.round(confidenceScore * 100)}% confidence
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={addMarker} className="focus-ring">
            <Bookmark className="w-4 h-4 mr-2" />
            Add Marker
            <kbd className="ml-2 kbd">⌘M</kbd>
          </Button>
          <Button variant="outline" className="focus-ring">
            <Settings2 className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>
      </header>

      {/* Recording Controls */}
      <div className="p-6 border-b border-border bg-surface/50">
        <div className="flex items-center justify-center gap-6 mb-6">
          {!isRecording ? (
            <Button
              onClick={onStart}
              size="lg"
              className="bg-gradient-primary hover:opacity-90 focus-ring px-8 py-4"
            >
              <Mic className="w-6 h-6 mr-3" />
              Start Recording
            </Button>
          ) : (
            <div className="flex items-center gap-3">
              <Button
                onClick={onPause}
                variant="outline"
                size="lg"
                className="focus-ring"
              >
                {isPaused ? (
                  <>
                    <Play className="w-5 h-5 mr-2" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="w-5 h-5 mr-2" />
                    Pause
                  </>
                )}
              </Button>
              <Button
                onClick={onStop}
                variant="outline"
                size="lg"
                className="text-danger border-danger hover:bg-danger hover:text-danger-foreground focus-ring"
              >
                <Square className="w-5 h-5 mr-2" />
                Stop
              </Button>
            </div>
          )}
        </div>

        {/* Waveform */}
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6"
          >
            <WaveformVisualizer
              height={60}
              isPlaying={!isPaused}
              className="rounded-lg bg-surface-alt/30 p-4"
            />
          </motion.div>
        )}

        {/* Audio Controls */}
        <div className="flex items-center justify-center gap-8">
          <div className="flex items-center gap-3">
            <Volume2 className="w-4 h-4 text-text-secondary" />
            <div className="w-24">
              <Slider
                value={volume}
                max={1}
                step={0.1}
                onValueChange={setVolume}
              />
            </div>
            <span className="text-sm text-text-secondary w-8">
              {Math.round(volume[0] * 100)}%
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-secondary">Font Size</span>
            <div className="w-24">
              <Slider
                value={fontSize}
                min={12}
                max={24}
                step={2}
                onValueChange={setFontSize}
              />
            </div>
            <span className="text-sm text-text-secondary w-8">
              {fontSize[0]}px
            </span>
          </div>
        </div>
      </div>

      {/* Live Captions */}
      <div className="flex-1 flex">
        {/* Caption Display */}
        <div className="flex-1 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-primary">
              Live Captions
            </h2>
            {isRecording && (
              <Badge 
                variant="outline" 
                className="text-primary border-primary animate-pulse"
              >
                <div className="w-2 h-2 rounded-full bg-primary mr-2" />
                Recording
              </Badge>
            )}
          </div>
          
          <Card className="h-full">
            <CardContent className="p-6 h-full overflow-auto">
              <div className="space-y-4">
                <AnimatePresence>
                  {captions.map((caption, index) => (
                    <motion.div
                      key={caption.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                      className={cn(
                        "p-3 rounded-lg transition-all",
                        caption.isFinal 
                          ? "bg-surface-alt/30" 
                          : "bg-primary/10 border border-primary/20",
                        activeCaptions.includes(caption) && "ring-2 ring-primary/50"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {caption.speaker && (
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3 text-primary" />
                            <span className="text-sm font-medium text-primary">
                              {caption.speaker}
                            </span>
                          </div>
                        )}
                        <span className="text-xs text-text-secondary">
                          {formatDuration(caption.startMs)}
                        </span>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs",
                            getConfidenceColor(caption.confidence)
                          )}
                        >
                          {Math.round(caption.confidence * 100)}%
                        </Badge>
                        {!caption.isFinal && (
                          <Badge variant="outline" className="text-xs animate-pulse">
                            Live
                          </Badge>
                        )}
                      </div>
                      <p 
                        className="text-text-primary leading-relaxed"
                        style={{ fontSize: `${fontSize[0]}px` }}
                      >
                        {caption.text}
                      </p>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div ref={captionsEndRef} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Session Stats */}
        <div className="w-80 p-6 border-l border-border bg-surface-alt/20">
          <h3 className="text-lg font-semibold text-text-primary mb-4">
            Session Stats
          </h3>
          
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-surface-alt/50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-text-secondary">Duration</span>
                <span className="font-mono text-text-primary">
                  {formatDuration(sessionDuration)}
                </span>
              </div>
            </div>
            
            <div className="p-3 rounded-lg bg-surface-alt/50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-text-secondary">Words</span>
                <span className="font-mono text-text-primary">
                  {captions.reduce((acc, caption) => 
                    acc + caption.text.split(' ').length, 0
                  )}
                </span>
              </div>
            </div>
            
            <div className="p-3 rounded-lg bg-surface-alt/50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-text-secondary">Avg Latency</span>
                <span className={cn("font-mono", getLatencyColor(latencyMs))}>
                  {latencyMs}ms
                </span>
              </div>
            </div>
            
            <div className="p-3 rounded-lg bg-surface-alt/50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-text-secondary">Avg Confidence</span>
                <span className={cn("font-mono", getConfidenceColor(confidenceScore))}>
                  {Math.round(confidenceScore * 100)}%
                </span>
              </div>
            </div>
          </div>
          
          <div className="mt-6 pt-6 border-t border-border">
            <h4 className="text-sm font-semibold text-text-primary mb-3">
              Keyboard Shortcuts
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-secondary">Start/Stop</span>
                <kbd className="kbd">⌘R</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Pause</span>
                <kbd className="kbd">Space</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Add Marker</span>
                <kbd className="kbd">⌘M</kbd>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealtimeConsole;