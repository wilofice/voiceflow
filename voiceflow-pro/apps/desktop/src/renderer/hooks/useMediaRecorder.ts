import { useRef, useState, useCallback, useEffect } from 'react';

export type MicState = 'idle' | 'requesting' | 'recording' | 'paused' | 'stopped';

interface UseMediaRecorderOptions {
    onDataAvailable?: (blob: Blob) => void;
    onStop?: (blob: Blob) => void;
    onError?: (error: string) => void;
    /** Milliseconds between each chunk event. Default: 1000 */
    timeslice?: number;
}

interface UseMediaRecorderReturn {
    state: MicState;
    start: () => Promise<boolean>;
    stop: () => void;
    pause: () => void;
    resume: () => void;
    blob: Blob | null;
    stream: MediaStream | null;
}

/**
 * A React hook that wraps navigator.mediaDevices.getUserMedia + MediaRecorder.
 * Provides start/stop/pause/resume actions and emits the final compiled Blob via onStop.
 */
export function useMediaRecorder({
    onDataAvailable,
    onStop,
    onError,
    timeslice = 1000,
}: UseMediaRecorderOptions = {}): UseMediaRecorderReturn {
    const [state, setState] = useState<MicState>('idle');
    const [blob, setBlob] = useState<Blob | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);

    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);

    // Clean up stream tracks on unmount
    useEffect(() => {
        return () => {
            streamRef.current?.getTracks().forEach(t => t.stop());
        };
    }, []);

    const start = useCallback(async () => {
        if (state !== 'idle' && state !== 'stopped') return false;

        setState('requesting');
        chunksRef.current = [];

        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            streamRef.current = mediaStream;
            setStream(mediaStream);

            // Prefer webm/opus for broad FFmpeg compatibility; fall back to browser default
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : '';

            const recorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined);
            recorderRef.current = recorder;

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                    onDataAvailable?.(event.data);
                }
            };

            recorder.onstop = () => {
                const finalBlob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
                setBlob(finalBlob);
                setState('stopped');
                onStop?.(finalBlob);
                // Stop all mic tracks to release the OS-level mic indicator
                mediaStream.getTracks().forEach(t => t.stop());
                setStream(null);
            };

            recorder.onerror = (event: any) => {
                const msg = event?.error?.message || 'MediaRecorder error';
                onError?.(msg);
                setState('idle');
            };

            recorder.start(timeslice);
            setState('recording');
            return true;
        } catch (err: any) {
            const msg = err?.message?.includes('Permission denied')
                ? 'Microphone permission was denied. Please allow microphone access and try again.'
                : err?.message || 'Failed to access microphone';
            onError?.(msg);
            setState('idle');
            return false;
        }
    }, [state, timeslice, onDataAvailable, onStop, onError]);

    const stop = useCallback(() => {
        if (recorderRef.current && (state === 'recording' || state === 'paused')) {
            recorderRef.current.stop();
        }
    }, [state]);

    const pause = useCallback(() => {
        if (recorderRef.current && state === 'recording') {
            recorderRef.current.pause();
            setState('paused');
        }
    }, [state]);

    const resume = useCallback(() => {
        if (recorderRef.current && state === 'paused') {
            recorderRef.current.resume();
            setState('recording');
        }
    }, [state]);

    return { state, start, stop, pause, resume, blob, stream };
}
