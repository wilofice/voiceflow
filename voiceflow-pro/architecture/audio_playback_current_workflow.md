# Current Audio Insertion Architecture (Pre-Audit)

This diagram maps out exactly what the application is currently doing when you drag and drop a file into the Batch Jobs UI, showing the exact pipeline that populates the `audioUrl` tracking string.

```mermaid
sequenceDiagram
    participant UI as React Batch UI
    participant Store as Zustand batchStore
    participant API as Fastify Backend (POST /batch/items)
    participant SB as Supabase Storage
    participant DB as Prisma Database

    %% Upload Phase
    Note over UI, DB: Step 1: Initial Upload & Database Tracking
    UI->>Store: Drop Audio File (e.g. sample2.mp3)
    Store->>Store: Maps absolute local path into memory (localFilePaths)
    Store->>API: HTTP POST Multipart FormData (Blob ArrayBuffer)
    
    API->>API: Generates `uniqueFilename` (e.g. `user_id/batch-xxx/xxx.mp3`)
    API->>SB: Uploads Buffer to 'audio-files' Bucket (Potentially 0-bytes or failing)
    API->>DB: Creates Transcript Row with `audioUrl = uniqueFilename`
    
    %% Processing Phase
    Note over UI, DB: Step 2: Native Transcription
    Store->>ElectronIPC: window.electronAPI.whisper.transcribeFile(localFilePaths)
    ElectronIPC->>ElectronIPC: Decodes macOS physical file to Float32Array
    ElectronIPC->>ElectronIPC: Xenova returns text segments
    ElectronIPC-->>Store: Dispatch Result
    Store->>API: PUT /transcripts/:id (Saves text & segments)
    API->>DB: Updates database with text
    
    %% Playback Phase
    Note over UI, DB: Step 3: Fetching for Playback (The Crash)
    UI->>API: GET /api/transcripts/:id
    API->>DB: Retrieves Transcript Row 
    DB-->>API: Returns { audioUrl: 'user_id/batch-xxx/xxx.mp3' }
    API->>API: Mutates to { audioUrl: '/api/transcripts/:id/audio' }
    API-->>UI: Hands back payload to React
    UI->>API: Browser executes `<audio src="/api/transcripts/:id/audio">`
    API->>SB: Fastify attempts to generate Signed URL or Pipe from Supabase
    SB-->>API: 404 Not Found (or Corrupt 0-byte stream)
    API-->>UI: Connection breaks
    UI->>UI: Throws DOMException / Network Catch (Popup trigger)
```

### Suspected Failure Points to Audit
1. **The Blob Buffer:** Is the React UI sending an empty Blob in the `FormData` during `batchStore.ts` upload?
2. **The Supabase Upload:** Is `uploadFile` succeeding, or secretly masking a 0-byte chunk?
3. **The Disconnect:** We are transcribing the local macOS HD file flawlessly offline, but relying on the generic Supabase cloud copy for Playback! Since this is an offline-first app, this entire database insertion step should likely bypass Supabase completely and just securely log the macOS local path.
