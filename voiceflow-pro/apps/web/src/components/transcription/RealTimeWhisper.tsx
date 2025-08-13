'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { WhisperWebEngine, TranscriptionSegment, WhisperConfig } from '@/lib/whisper/whisperEngine';
import { WhisperModel } from '@/lib/whisper/modelManager';
import { trackWhisperEvent, logWhisperError } from '@/lib/whisper/analytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { StreamingTranscript } from './StreamingTranscript';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AudioVisualizer } from '@/components/ui/audio-visualizer';
import {
  Mic,
  MicOff,
  Square,
  Play,
  Pause,
  Settings,
  Volume2,
  VolumeX,
  Loader2,
  AlertCircle,
  CheckCircle,
  Zap
} from 'lucide-react';

export interface RealTimeWhisperProps {
  onTranscriptUpdate?: (segment: TranscriptionSegment) => void;
  onFullTranscriptUpdate?: (fullText: string, segments: TranscriptionSegment[]) => void;
  modelSize?: WhisperModel;
  language?: string;
  enableNoiseSuppression?: boolean;
  enableEchoCancellation?: boolean;
  className?: string;
}


export function RealTimeWhisper({
  onTranscriptUpdate,
  onFullTranscriptUpdate,
  modelSize = 'tiny',
  language = 'en',
  enableNoiseSuppression = true,
  enableEchoCancellation = true,
  className = ''
}: RealTimeWhisperProps) {
  const [whisperEngine, setWhisperEngine] = useState<WhisperWebEngine | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [segments, setSegments] = useState<TranscriptionSegment[]>([]);
  const [currentSegment, setCurrentSegment] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioData, setAudioData] = useState<Float32Array | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const stopFunctionRef = useRef<(() => void) | null>(null);
  const audioBufferRef = useRef<Float32Array[]>([]);
  const lastProcessTimeRef = useRef(0);

  // Initialize Whisper engine
  const initializeWhisper = useCallback(async () => {
    if (isInitialized || isInitializing) return;

    setIsInitializing(true);
    setError(null);

    try {
      const engine = new WhisperWebEngine();
      await engine.initialize({
        model: modelSize,
        language: language,
        task: 'transcribe',
        wordTimestamps: true,
      });

      setWhisperEngine(engine);
      setIsInitialized(true);

      trackWhisperEvent('initialization', {
        model: modelSize,
        duration: Date.now(),
        success: true,
        cached: true, // Assume cached for now
      });

    } catch (err: any) {
      const errorMsg = `Failed to initialize Whisper: ${err.message}`;
      setError(errorMsg);
      logWhisperError(err, {
        operation: 'initialization',
        model: modelSize,
      }, 'high');
    } finally {
      setIsInitializing(false);
    }
  }, [modelSize, language, isInitialized, isInitializing]);

  // Start recording
  const startRecording = useCallback(async () => {
    if (!isInitialized || !whisperEngine) {
      await initializeWhisper();
      return;
    }

    try {
      setError(null);

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: enableEchoCancellation,
          noiseSuppression: enableNoiseSuppression,
          autoGainControl: true,
          sampleRate: 16000,
        },
      });

      mediaStreamRef.current = stream;

      // Set up audio context
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      
      // Set up analyzer for visualization
      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 256;
      analyzerRef.current = analyzer;
      source.connect(analyzer);

      // Set up processor for real-time transcription
      const processor = audioContext.createScriptProcessor(16384, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = async (event) => {
        if (isPaused) return;

        const inputBuffer = event.inputBuffer.getChannelData(0);
        const audioChunk = new Float32Array(inputBuffer);
        
        // Update audio visualization
        setAudioData(audioChunk);
        
        // Calculate audio level
        const level = Math.sqrt(audioChunk.reduce((sum, sample) => sum + sample * sample, 0) / audioChunk.length);
        setAudioLevel(level);

        // Buffer audio for processing
        audioBufferRef.current.push(audioChunk);

        // Process every 2 seconds of audio
        const now = Date.now();
        if (now - lastProcessTimeRef.current >= 2000 && audioBufferRef.current.length > 0) {
          lastProcessTimeRef.current = now;
          processAudioBuffer();
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      setIsRecording(true);

      // Set up stop function
      const stopRecording = () => {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(track => track.stop());
          mediaStreamRef.current = null;
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        if (processorRef.current) {
          processorRef.current.disconnect();
          processorRef.current = null;
        }
        setIsRecording(false);
        setIsPaused(false);
        setAudioLevel(0);
        setAudioData(null);
      };

      stopFunctionRef.current = stopRecording;

    } catch (err: any) {
      const errorMsg = `Failed to start recording: ${err.message}`;
      setError(errorMsg);
      logWhisperError(err, {
        operation: 'start_recording',
        model: modelSize,
      }, 'medium');
    }
  }, [isInitialized, whisperEngine, initializeWhisper, enableEchoCancellation, enableNoiseSuppression, isPaused, modelSize]);

  // Process audio buffer
  const processAudioBuffer = useCallback(async () => {
    if (!whisperEngine || audioBufferRef.current.length === 0 || isProcessing) return;

    setIsProcessing(true);
    setProcessingProgress(0);

    try {
      // Combine audio chunks
      const totalLength = audioBufferRef.current.reduce((sum, chunk) => sum + chunk.length, 0);
      const combinedBuffer = new Float32Array(totalLength);
      let offset = 0;
      
      for (const chunk of audioBufferRef.current) {
        combinedBuffer.set(chunk, offset);
        offset += chunk.length;
      }

      // Clear buffer
      audioBufferRef.current = [];

      // Update progress
      setProcessingProgress(50);

      // Transcribe
      const result = await whisperEngine.transcribeAudio(combinedBuffer);
      
      setProcessingProgress(100);

      if (result.segments && result.segments.length > 0) {
        const newSegments = result.segments.filter(seg => seg.text.trim().length > 0);
        
        if (newSegments.length > 0) {
          setSegments(prev => [...prev, ...newSegments]);
          
          // Update current segment
          const latestText = newSegments[newSegments.length - 1].text;
          setCurrentSegment(latestText);

          // Notify callbacks
          newSegments.forEach(segment => {
            onTranscriptUpdate?.(segment);
          });

          const allSegments = [...segments, ...newSegments];
          const fullText = allSegments.map(s => s.text).join(' ');
          onFullTranscriptUpdate?.(fullText, allSegments);
        }
      }

    } catch (err: any) {
      console.error('Processing error:', err);
      logWhisperError(err, {
        operation: 'realtime_processing',
        model: modelSize,
      }, 'medium');
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  }, [whisperEngine, segments, isProcessing, onTranscriptUpdate, onFullTranscriptUpdate, modelSize]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (stopFunctionRef.current) {
      stopFunctionRef.current();
      stopFunctionRef.current = null;
    }

    // Process any remaining audio
    if (audioBufferRef.current.length > 0) {
      processAudioBuffer();
    }
  }, [processAudioBuffer]);

  // Toggle pause
  const togglePause = useCallback(() => {
    setIsPaused(prev => !prev);
  }, []);

  // Clear transcript
  const clearTranscript = useCallback(() => {
    setSegments([]);
    setCurrentSegment('');
    audioBufferRef.current = [];
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      if (whisperEngine) {
        whisperEngine.destroy();
      }
    };
  }, [whisperEngine, stopRecording]);

  const getAudioLevelColor = () => {
    if (audioLevel > 0.3) return 'bg-red-500';
    if (audioLevel > 0.1) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Mic className="w-5 h-5" />
              <span>Real-time Transcription</span>
              {isInitialized && (
                <Badge variant="default" className="text-xs">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  {modelSize} Ready
                </Badge>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Select value={language} onValueChange={() => {}}>
                <SelectTrigger className="w-24 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="en">EN</SelectItem>
                  <SelectItem value="es">ES</SelectItem>
                  <SelectItem value="fr">FR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Initialization */}
          {!isInitialized && (
            <div className="text-center py-4">
              <Button
                onClick={initializeWhisper}
                disabled={isInitializing}
                className="mb-2"
              >
                {isInitializing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Initializing Whisper...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Initialize Real-time Transcription
                  </>
                )}
              </Button>
              <p className="text-sm text-gray-500">
                This will load the {modelSize} model for real-time processing
              </p>
            </div>
          )}

          {/* Controls */}
          {isInitialized && (
            <div className="flex items-center justify-center space-x-4">
              <Button
                onClick={isRecording ? stopRecording : startRecording}
                variant={isRecording ? "destructive" : "default"}
                size="lg"
                className="min-w-32"
              >
                {isRecording ? (
                  <>
                    <Square className="w-4 h-4 mr-2" />
                    Stop
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 mr-2" />
                    Start Recording
                  </>
                )}
              </Button>

              {isRecording && (
                <Button
                  onClick={togglePause}
                  variant="outline"
                  size="lg"
                >
                  {isPaused ? (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Resume
                    </>
                  ) : (
                    <>
                      <Pause className="w-4 h-4 mr-2" />
                      Pause
                    </>
                  )}
                </Button>
              )}

              <Button
                onClick={clearTranscript}
                variant="outline"
                size="lg"
                disabled={isRecording}
              >
                Clear
              </Button>
            </div>
          )}

          {/* Audio Visualization */}
          {isRecording && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center space-x-2">
                  {audioLevel > 0.01 ? (
                    <Volume2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-gray-400" />
                  )}
                  <span>Audio Level</span>
                </span>
                <Badge 
                  variant={isPaused ? "secondary" : "default"} 
                  className="text-xs"
                >
                  {isPaused ? 'Paused' : 'Recording'}
                </Badge>
              </div>

              <div className="flex items-center space-x-2">
                <div className="flex-1">
                  <AudioVisualizer 
                    audioData={audioData} 
                    isActive={isRecording && !isPaused}
                    variant="waveform"
                    height={60}
                  />
                </div>
                <div className={`w-2 h-8 rounded ${getAudioLevelColor()} transition-all`} />
              </div>

              {/* Processing Progress */}
              {isProcessing && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Processing audio...</span>
                    <span>{Math.round(processingProgress)}%</span>
                  </div>
                  <Progress value={processingProgress} className="h-1" />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live Transcript */}
      <StreamingTranscript
        segments={segments}
        currentSegment={currentSegment}
        isRecording={isRecording}
        isProcessing={isProcessing}
        onSegmentClick={(segment) => {
          // TODO: Implement seeking to segment timestamp
          console.log('Clicked segment:', segment);
        }}
        onCopyTranscript={() => {
          trackWhisperEvent('transcription', {
            method: 'realtime',
            segmentCount: segments.length,
          });
        }}
        onExportTranscript={() => {
          trackWhisperEvent('transcription', {
            method: 'realtime',
            segmentCount: segments.length,
            type: 'export'
          });
        }}
      />
    </div>
  );
}