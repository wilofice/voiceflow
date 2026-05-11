import { create } from 'zustand';
import { apiClient } from '../services/apiClient';

// ── Types ──────────────────────────────────────────────────────────────────

export type RecordingState =
    | 'IDLE'
    | 'REQUESTING_MIC'
    | 'RECORDING'
    | 'PAUSED'
    | 'STOPPING'
    | 'TRANSCRIBING'
    | 'SAVING'
    | 'COMPLETED'
    | 'ERROR';

interface LiveRecordStore {
    // State
    status: RecordingState;
    error: string | null;
    elapsedMs: number;
    transcriptId: string | null;
    progressMessage: string | null;

    // Actions
    setStatus: (status: RecordingState) => void;
    setError: (err: string | null) => void;
    setElapsedMs: (ms: number) => void;
    setTranscriptId: (id: string | null) => void;
    setProgressMessage: (msg: string | null) => void;

    /**
     * Process the recorded Blob: pipe through IPC → WhisperService → save to DB.
     * Returns the new transcript ID on success, null on failure.
     */
    processRecording: (blob: Blob, model?: string, language?: string) => Promise<string | null>;

    reset: () => void;
}

// ── Store ──────────────────────────────────────────────────────────────────

export const useLiveRecordStore = create<LiveRecordStore>((set, get) => ({
    status: 'IDLE',
    error: null,
    elapsedMs: 0,
    transcriptId: null,
    progressMessage: null,

    setStatus: (status) => set({ status }),
    setError: (error) => set({ error }),
    setElapsedMs: (ms) => set({ elapsedMs: ms }),
    setTranscriptId: (id) => set({ transcriptId: id }),
    setProgressMessage: (msg) => set({ progressMessage: msg }),

    processRecording: async (blob: Blob, model = 'base', language = 'auto') => {
        set({ status: 'TRANSCRIBING', progressMessage: 'Sending to Whisper engine…', error: null });

        try {
            // Convert browser Blob → Uint8Array for safe IPC transfer.
            // Raw ArrayBuffer is NOT reliably transferred by Electron's structured clone;
            // Uint8Array (a TypedArray view) survives the IPC boundary intact.
            const arrayBuffer = await blob.arrayBuffer();
            const uint8 = new Uint8Array(arrayBuffer);

            // Diagnostic: log what the whisper API surface looks like at call time
            console.log('[LiveRecord] window.electronAPI.whisper keys:',
                Object.keys((window as any).electronAPI?.whisper ?? {}));

            // Prefer the structured API; fall back to the raw IPC bridge if the
            // method is absent (can happen with Electron contextBridge caching).
            let ipcResult: { success: boolean; result?: any; error?: string };
            const whisperApi = (window as any).electronAPI?.whisper;
            if (typeof whisperApi?.transcribeBuffer === 'function') {
                ipcResult = await whisperApi.transcribeBuffer(uint8, { model, language });
            } else {
                console.warn('[LiveRecord] transcribeBuffer not found on electronAPI.whisper, using raw IPC bridge');
                ipcResult = await (window as any).electron.ipcRenderer.invoke(
                    'whisper:transcribe-buffer',
                    uint8,
                    { model, language }
                );
            }


            if (!ipcResult.success || !ipcResult.result) {
                throw new Error(ipcResult.error || 'Whisper transcription returned no result');
            }

            const { text, segments } = ipcResult.result;

            set({ status: 'SAVING', progressMessage: 'Saving transcript to database…' });

            // Create a stub transcript record in DB (no audioUrl for live recordings)
            const title = `Recording – ${new Date().toLocaleString()}`;
            const newTranscript = await apiClient.createLiveRecordingTranscript({
                title,
                language: ipcResult.result.language || language,
                status: 'COMPLETED',
                audioUrl: '',
                duration: 0,
            });

            // Persist text + segments
            await apiClient.updateTranscript(newTranscript.id, {
                status: 'COMPLETED',
                text,
                segments: (segments || []).map((s: any) => ({
                    text: s.text,
                    startTime: s.start,
                    endTime: s.end,
                    confidence: s.confidence ?? 1.0,
                })),
            });

            set({ status: 'COMPLETED', transcriptId: newTranscript.id, progressMessage: null });
            return newTranscript.id;

        } catch (err: any) {
            console.error('Live recording processing failed:', err);
            set({ status: 'ERROR', error: err.message || 'Failed to process recording', progressMessage: null });
            return null;
        }
    },

    reset: () => set({
        status: 'IDLE',
        error: null,
        elapsedMs: 0,
        transcriptId: null,
        progressMessage: null,
    }),
}));
