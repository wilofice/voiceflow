# Dashboard Sidebar Data Flow 

This diagram illustrates how the `NavigationSidebar` will transition from static mock data to dynamically fetching and computing live UI metrics from the Supabase backend via `apiClient`.

```mermaid
sequenceDiagram
    participant UI as VoiceFlowPro (React)
    participant Sidebar as NavigationSidebar
    participant TStore as transcriptStore (Zustand)
    participant PStore as projectStore (Zustand)
    participant APIClient
    participant API as Fastify API
    participant DB as Supabase/Prisma

    %% 1. Application Initialization
    UI->>TStore: fetchTranscripts() on Mount
    UI->>PStore: fetchProjects() on Mount [Task 5 Prep]

    TStore->>APIClient: GET /api/transcripts
    PStore->>APIClient: GET /api/projects

    APIClient->>API: HTTP Request
    API->>DB: Query
    DB-->>API: Rows fetched
    API-->>APIClient: JSON Response
    APIClient-->>TStore: Update State
    APIClient-->>PStore: Update State

    %% 2. Dynamic Metric Computation
    Note over UI: Zustand stores compute derived sidebar metrics automatically

    TStore->>TStore: Compute 'All Transcripts' Count (Length)
    TStore->>TStore: Compute 'Recent Files' (Sort by Date DESC, limit 5)
    TStore->>TStore: Compute 'Starred/Favorites' (Filter by isStarred)

    %% 3. Propagating to UI
    UI->>Sidebar: Pass hydrated RecentFiles[]
    UI->>Sidebar: Pass hydrated Projects[]
    UI->>Sidebar: Pass computed metrics (Total, Starred, etc)

    Note over Sidebar: UI reflects accurate live database values!
```

### Action Plan for Task 1:
1. Update `NavigationSidebar` props interface to accept dynamic numbers (`totalTranscripts`, `starredCount`, etc).
2. Hook up `useTranscriptStore()` in the main `VoiceFlowPro.tsx` parent.
3. Pass the derived arrays and counts downward as props into `<NavigationSidebar>`.
4. *Note on Projects:* Since full project CRUD management is scheduled for Task 5, we will temporarily supply an empty array directly from a newly scaffolded `projectStore`, setting us up perfectly for Task 5.
