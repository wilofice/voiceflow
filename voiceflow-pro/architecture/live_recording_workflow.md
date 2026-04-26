# Live Recording & Transcription Workflow

This sequence diagram explains how our native Desktop application will handle real-time microphone capture, routing it safely from the React browser context into the heavily optimized Electron Main process for transcription.

```mermaid
sequenceDiagram
    participant Mic as User Microphone
    participant UI as React UI (MediaRecorder)
    participant Store as liveRecordStore (Zustand)
    participant IPC as Electron IPC Bridge
    participant Whisper as WhisperService (Xenova)
    participant FFmpeg as FFmpeg Pipeline

    %% Recording Phase
    Note over Mic,UI: User clicks "Start Live Recording"
    Mic->>UI: Request audio stream via navigator.mediaDevices
    
    loop Every 5 Seconds (Real-Time Chunking)
        UI->>UI: Capture chunk (webm/ogg format)
        UI->>Store: Append chunk to memory buffer
    end
    
    %% Processing Phase
    Note over Mic,UI: User clicks "Stop"
    UI->>Store: Compile final Blob
    Store->>IPC: window.electronAPI.whisper.transcribeBuffer(ArrayBuffer)
    
    IPC->>FFmpeg: Pipe Buffer through FFmpeg memory stream
    FFmpeg-->>FFmpeg: Convert to 16kHz, mono, Float32 format
    FFmpeg->>Whisper: Pass processed PCM Audio 
    
    Note over Whisper: Xenova / Transformers.js execution
    Whisper-->>IPC: Return transcribed text segments
    IPC-->>Store: Dispatch results
    Store-->>UI: Display Text in Editor & Save Draft to DB
```

### Action Plan
1. Hook into the `navigator.mediaDevices.getUserMedia()` browser API securely inside `VoiceFlowPro`.
2. Implement a `MediaRecorder` that collects the audio blobs into a single continuous stream buffer.
3. Expose a new IPC method: `window.electronAPI.whisper.transcribeBuffer(...)` allowing us to pass raw memory blobs directly to the local decoder without saving a temp `.mp3` file.
4. Execute Xenova and render the results live.
