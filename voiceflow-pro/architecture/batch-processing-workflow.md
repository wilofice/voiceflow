# Local Batch Processing Workflow (Xenova + Client-Side Orchestration)

This diagram illustrates the newly localized batch processing loop that completely bypasses the backend BullMQ/`whisper.cpp` queue, leveraging the native Electron Main Process iteratively powered by `transformers.js`.

```mermaid
sequenceDiagram
    participant UI as Desktop React UI
    participant Store as batchStore.ts (Zustand)
    participant APIClient as API Client (Frontend)
    participant API as Fastify API (Backend)
    participant DB as Postgres/Supabase
    participant Main as Electron Main Process (WhisperService)

    %% 1. Initialization and Upload
    UI->>Store: Drop batch files (addFiles)
    Store->>Store: Cache Memory Map (fileName -> local path)
    Store->>APIClient: POST /api/batch/jobs/:id/items (Upload blobs)
    APIClient->>API: Pass files securely
    API->>DB: Save batch item + Upload audio to Supabase
    API-->>Store: Confirm Added & return metadata

    %% 2. Start Request triggering Iterator
    UI->>Store: Click "Start Batch" (startJob)
    Store->>APIClient: POST /api/batch/jobs/:id/start
    APIClient->>API: update job status
    API->>DB: Set job status to RUNNING (NO MORE BULLMQ QUEUE!)
    API-->>Store: Job is now RUNNING
    
    %% 3. The Local Iteration Loop
    Note over Store: Iterating over pending batch items
    loop Process Job Localy (Every PENDING item)
        Store->>Store: Lookup absolute local file path from cache map
        
        %% Optimistic UI & Processing State
        Store->>APIClient: PUT /api/batch/jobs/:id/items/:itemId (PROCESSING)
        APIClient->>API: Update item status to PROCESSING
        API->>DB: DB Save
        API-->>APIClient: Confirm
        APIClient-->>Store: Emit 'batch:item_progress' event

        %% Heavy lifting natively
        Store->>Main: IPC whisper:transcribe-file (local path)
        Note over Main: Transcribe purely natively via @xenova/transformers
        Main-->>Store: Return { success, result: text & segments }

        %% Conclude Loop Element
        Store->>APIClient: PUT /api/transcripts/:id (Save transcript segments)
        APIClient->>API: Store completed transcribed blobs
        API->>DB: Commit completed transcript segments
        
        Store->>APIClient: PUT /api/batch/jobs/:id/items/:itemId (COMPLETED)
        APIClient->>API: Update item status to COMPLETED
        API->>DB: DB Save
        API-->>APIClient: Confirm
        APIClient-->>Store: Emit 'batch:item_completed' event to auto-refresh UI
    end
    
    %% 4. Completion
    Store->>APIClient: Check DB if every item is COMPLETED
    APIClient->>API: GET /api/batch/jobs/:id
    API-->>Store: Job items
    Store->>APIClient: PUT /api/batch/jobs/:id (COMPLETED)
    APIClient->>API: Update Job Header to COMPLETED
    API->>DB: DB Save
    Note over UI: The entire batch is successfully processed offline-first!
```
