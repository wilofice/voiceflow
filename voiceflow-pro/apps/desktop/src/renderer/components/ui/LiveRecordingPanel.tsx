import { motion, AnimatePresence } from 'framer-motion';
import {
    Mic,
    MicOff,
    Pause,
    Play,
    Square,
    Loader2,
    CheckCircle2,
    AlertCircle,
    ArrowRight,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useMediaRecorder } from '../../hooks/useMediaRecorder';
import { useLiveRecordStore } from '../../stores/liveRecordStore';

interface LiveRecordingPanelProps {
    onTranscriptReady?: (transcriptId: string) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hours > 0) return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// ── Waveform visualizer ────────────────────────────────────────────────────

function WaveformVisualizer({ stream }: { stream: MediaStream | null }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animRef = useRef<number | undefined>(undefined);
    const analyserRef = useRef<AnalyserNode | undefined>(undefined);

    useEffect(() => {
        if (!stream) {
            cancelAnimationFrame(animRef.current!);
            // Clear canvas
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx?.clearRect(0, 0, canvas.width, canvas.height);
            }
            return;
        }

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioCtx();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        const data = new Uint8Array(analyser.frequencyBinCount);
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;

        const draw = () => {
            animRef.current = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(data);

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const barWidth = (canvas.width / data.length) * 2.5;
            let x = 0;

            data.forEach(value => {
                const barHeight = (value / 255) * canvas.height;
                const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
                gradient.addColorStop(0, 'hsl(262, 83%, 70%)');
                gradient.addColorStop(1, 'hsl(262, 83%, 40%)');
                ctx.fillStyle = gradient;
                ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                x += barWidth + 1;
            });
        };

        draw();

        return () => {
            cancelAnimationFrame(animRef.current!);
            audioCtx.close();
        };
    }, [stream]);

    return (
        <canvas
            ref={canvasRef}
            width={320}
            height={64}
            className="w-full rounded-md bg-surface-alt/40"
        />
    );
}

// ── Main Panel ─────────────────────────────────────────────────────────────

export const LiveRecordingPanel: React.FC<LiveRecordingPanelProps> = ({
    onTranscriptReady,
}) => {
    const { toast } = useToast();
    const {
        status,
        error,
        progressMessage,
        transcriptId,
        processRecording,
        reset,
    } = useLiveRecordStore();

    // Elapsed timer
    const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
    const startTimeRef = useRef<number>(0);
    const [elapsed, setElapsed] = useState(0);

    const startTimer = () => {
        startTimeRef.current = Date.now() - elapsed;
        timerRef.current = setInterval(() => {
            setElapsed(Date.now() - startTimeRef.current);
        }, 500);
    };

    const stopTimer = () => clearInterval(timerRef.current);

    useEffect(() => () => stopTimer(), []);

    const recorder = useMediaRecorder({
        onStop: async (blob) => {
            stopTimer();
            const id = await processRecording(blob);
            if (id && onTranscriptReady) {
                onTranscriptReady(id);
            }
        },
        onError: (msg) => {
            toast({ title: 'Microphone Error', description: msg, variant: 'destructive' });
        },
    });

    const handleStart = async () => {
        reset();
        setElapsed(0);
        useLiveRecordStore.getState().setStatus('REQUESTING_MIC');
        await recorder.start();
        if (recorder.state !== 'idle') {
            useLiveRecordStore.getState().setStatus('RECORDING');
            startTimer();
        }
    };

    const handlePause = () => {
        if (recorder.state === 'recording') {
            recorder.pause();
            stopTimer();
            useLiveRecordStore.getState().setStatus('PAUSED');
        } else {
            recorder.resume();
            startTimer();
            useLiveRecordStore.getState().setStatus('RECORDING');
        }
    };

    const handleStop = () => {
        recorder.stop();
        stopTimer();
        useLiveRecordStore.getState().setStatus('STOPPING');
    };

    const isRecording = recorder.state === 'recording';
    const isPaused = recorder.state === 'paused';
    const isActive = isRecording || isPaused;
    const isProcessing = status === 'TRANSCRIBING' || status === 'SAVING' || status === 'STOPPING';
    const isDone = status === 'COMPLETED';
    const isError = status === 'ERROR';

    return (
        <div className="flex flex-col items-center gap-6 py-8 px-4 max-w-lg mx-auto">
            {/* Title */}
            <div className="text-center space-y-1">
                <h2 className="text-2xl font-semibold text-text-primary tracking-tight">Live Recording</h2>
                <p className="text-sm text-text-secondary">
                    Record directly from your microphone — VoiceFlow will transcribe it locally.
                </p>
            </div>

            {/* Status Badge */}
            <AnimatePresence mode="wait">
                {isActive && (
                    <motion.div
                        key="recording-badge"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                    >
                        <Badge
                            variant="outline"
                            className={`gap-1.5 text-sm px-3 py-1 ${isPaused ? 'text-warning border-warning' : 'text-error border-error animate-pulse'}`}
                        >
                            <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-warning' : 'bg-error'}`} />
                            {isPaused ? 'Paused' : 'Recording'}
                        </Badge>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Mic Icon (idle state) */}
            {!isActive && !isProcessing && !isDone && !isError && (
                <motion.div
                    className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center"
                    whileHover={{ scale: 1.05 }}
                >
                    <Mic className="w-10 h-10 text-primary" />
                </motion.div>
            )}

            {/* Waveform (recording/paused) */}
            {isActive && (
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full space-y-2"
                >
                    <WaveformVisualizer stream={recorder.stream} />
                    <p className="text-center text-2xl font-mono font-semibold text-text-primary tabular-nums">
                        {formatTime(elapsed)}
                    </p>
                </motion.div>
            )}

            {/* Processing State */}
            {isProcessing && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center gap-3"
                >
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    <p className="text-sm text-text-secondary text-center">{progressMessage || 'Processing…'}</p>
                </motion.div>
            )}

            {/* Success State */}
            {isDone && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-3"
                >
                    <CheckCircle2 className="w-12 h-12 text-success" />
                    <p className="text-sm text-text-secondary">Transcript ready!</p>
                    {transcriptId && onTranscriptReady && (
                        <Button onClick={() => onTranscriptReady(transcriptId)} className="gap-2">
                            Open Transcript <ArrowRight className="w-4 h-4" />
                        </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => { reset(); setElapsed(0); }}>
                        Record Again
                    </Button>
                </motion.div>
            )}

            {/* Error State */}
            {isError && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center gap-3"
                >
                    <AlertCircle className="w-10 h-10 text-error" />
                    <p className="text-sm text-error text-center max-w-xs">{error}</p>
                    <Button variant="outline" size="sm" onClick={() => { reset(); setElapsed(0); }}>
                        Try Again
                    </Button>
                </motion.div>
            )}

            {/* Controls */}
            {!isProcessing && !isDone && !isError && (
                <div className="flex items-center gap-3">
                    {!isActive ? (
                        <Button
                            size="lg"
                            onClick={handleStart}
                            className="gap-2 px-8"
                            disabled={status === 'REQUESTING_MIC'}
                        >
                            {status === 'REQUESTING_MIC' ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Requesting mic…</>
                            ) : (
                                <><Mic className="w-4 h-4" /> Start Recording</>
                            )}
                        </Button>
                    ) : (
                        <>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={handlePause}
                                title={isPaused ? 'Resume' : 'Pause'}
                                className="h-11 w-11"
                            >
                                {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                            </Button>

                            <Button
                                variant="destructive"
                                size="lg"
                                onClick={handleStop}
                                className="gap-2 px-8"
                            >
                                <Square className="w-4 h-4 fill-current" />
                                Stop & Transcribe
                            </Button>

                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    recorder.stop();
                                    stopTimer();
                                    reset();
                                    setElapsed(0);
                                }}
                                title="Discard recording"
                                className="h-11 w-11"
                            >
                                <MicOff className="w-5 h-5 text-text-secondary" />
                            </Button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
