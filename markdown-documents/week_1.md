# VoiceFlow Pro - Week 1 Implementation Guide

## Overview
This document contains detailed implementation tasks for Week 1 of VoiceFlow Pro development. Each task includes specific prompts designed for Claude Code agent execution.

**Week 1 Goals:**
- ✅ Repository setup with monorepo structure
- ✅ Database schema and migrations
- ✅ Basic authentication with Supabase
- ✅ File upload and storage pipeline
- ✅ OpenAI Whisper API integration

**Timeline:** 5 working days
**Team:** Tech Lead + Frontend Engineer + AI/ML Engineer

---

## Task 1: Repository Setup and Monorepo Structure

### Prompt for Claude Code:
```
Create a new TypeScript monorepo for VoiceFlow Pro using the following structure:

PROJECT: VoiceFlow Pro - Audio Transcription Platform
TECH STACK: Next.js 14, Node.js, TypeScript, Prisma, Supabase

Please set up the repository with this exact structure:

voiceflow-pro/
├── README.md
├── package.json (workspace root)
├── tsconfig.json (base config)
├── .gitignore
├── .env.example
├── apps/
│   ├── web/                 # Next.js frontend
│   └── api/                 # Node.js backend API
├── packages/
│   ├── ui/                  # Shared React components
│   ├── shared/              # Shared utilities and types
│   └── database/            # Prisma schema and migrations
├── docs/
│   └── api.md
└── scripts/
    └── setup.sh

REQUIREMENTS:
1. Use npm workspaces for monorepo management
2. Set up TypeScript with strict mode across all packages
3. Configure ESLint and Prettier for consistent code formatting
4. Add scripts for development, build, and deployment
5. Include environment variable templates
6. Set up basic CI/CD configuration with GitHub Actions

Create all necessary package.json files, tsconfig.json configurations, and basic setup scripts.
Include a comprehensive README.md with setup instructions and development guidelines.
```

**Acceptance Criteria:**
- [ ] Monorepo structure created with all specified directories
- [ ] TypeScript configured across all packages
- [ ] Development scripts working (`npm run dev`, `npm run build`)
- [ ] ESLint and Prettier configured
- [ ] Environment variables template created

---

## Task 2: Database Schema Design and Setup

### Prompt for Claude Code:
```
Design and implement the database schema for VoiceFlow Pro using Prisma ORM.

PROJECT CONTEXT: Audio transcription platform with collaborative features
REQUIREMENTS: User management, file storage, transcriptions, real-time collaboration

Create the complete database setup in packages/database/ with:

1. PRISMA SCHEMA (schema.prisma):
   - Users table (id, email, name, subscription_tier, created_at, updated_at)
   - Transcripts table (id, user_id, title, duration, language, status, audio_url, created_at, updated_at)
   - TranscriptSegments table (id, transcript_id, start_time, end_time, text, speaker_id, confidence)
   - TranscriptComments table (id, transcript_id, user_id, segment_id, content, timestamp_position, created_at)
   - TranscriptShares table (id, transcript_id, shared_by, access_level, expires_at)

2. ENUMS:
   - TranscriptStatus: QUEUED, PROCESSING, COMPLETED, FAILED
   - SubscriptionTier: FREE, PRO, ENTERPRISE
   - AccessLevel: READ, COMMENT, EDIT

3. Setup Prisma client with proper TypeScript types
4. Create initial migration files
5. Add database seed data for development
6. Include database utilities and helpers

TECHNICAL REQUIREMENTS:
- Use UUID for all primary keys
- Add proper indexes for performance
- Include soft deletes where appropriate
- Add created_at/updated_at timestamps
- Ensure referential integrity with foreign keys

Create all necessary files including package.json, migration files, and seed scripts.
```

**Acceptance Criteria:**
- [ ] Prisma schema with all required tables
- [ ] Migration files generated
- [ ] Database seed script created
- [ ] TypeScript types generated
- [ ] Database connection utilities implemented

---

## Task 3: Next.js Frontend Application Setup

### Prompt for Claude Code:
```
Set up the Next.js 14 frontend application for VoiceFlow Pro in apps/web/.

PROJECT: Audio transcription web application
STACK: Next.js 14 (App Router), TypeScript, Tailwind CSS, Radix UI

REQUIREMENTS:
1. NEXT.JS CONFIGURATION:
   - App Router with TypeScript
   - Tailwind CSS with custom design system
   - Radix UI components for accessibility
   - File upload capabilities
   - Audio playback components

2. FOLDER STRUCTURE:
   apps/web/
   ├── src/
   │   ├── app/                    # App Router pages
   │   │   ├── layout.tsx
   │   │   ├── page.tsx           # Landing page
   │   │   ├── auth/              # Authentication pages
   │   │   ├── dashboard/         # Main app dashboard
   │   │   └── transcripts/       # Transcript pages
   │   ├── components/            # React components
   │   │   ├── ui/               # Base UI components
   │   │   ├── audio/            # Audio-related components
   │   │   ├── transcript/       # Transcript components
   │   │   └── layout/           # Layout components
   │   ├── lib/                  # Utilities and configurations
   │   ├── hooks/                # Custom React hooks
   │   └── types/                # TypeScript type definitions

3. CORE COMPONENTS TO CREATE:
   - AudioUpload: Drag and drop file upload
   - AudioPlayer: Playback with timeline
   - TranscriptEditor: Editable transcript interface
   - Navigation: App navigation and user menu
   - Layout: Main app layout wrapper

4. CONFIGURATION:
   - Tailwind with custom color palette
   - Next.js config for file uploads
   - TypeScript strict mode
   - Environment variables setup

Create a modern, responsive interface with proper TypeScript types and component structure.
```

**Acceptance Criteria:**
- [ ] Next.js 14 app with App Router configured
- [ ] Tailwind CSS and Radix UI integrated
- [ ] Core components created with TypeScript
- [ ] Responsive layout implemented
- [ ] File upload functionality working

---

## Task 4: Node.js Backend API Setup

### Prompt for Claude Code:
```
Create the Node.js backend API for VoiceFlow Pro in apps/api/.

PROJECT: REST API for audio transcription platform
STACK: Node.js, Fastify, TypeScript, Prisma, JWT authentication

REQUIREMENTS:
1. API STRUCTURE:
   apps/api/
   ├── src/
   │   ├── routes/              # API route handlers
   │   │   ├── auth.ts         # Authentication endpoints
   │   │   ├── transcripts.ts  # Transcript CRUD operations
   │   │   ├── upload.ts       # File upload handling
   │   │   └── users.ts        # User management
   │   ├── middleware/         # Custom middleware
   │   │   ├── auth.ts        # JWT authentication
   │   │   ├── validation.ts  # Request validation
   │   │   └── cors.ts        # CORS configuration
   │   ├── services/          # Business logic
   │   │   ├── transcription.ts
   │   │   ├── storage.ts
   │   │   └── auth.ts
   │   ├── types/             # TypeScript definitions
   │   ├── utils/             # Helper functions
   │   └── server.ts          # Main server file

2. API ENDPOINTS:
   POST   /api/auth/login
   POST   /api/auth/register
   GET    /api/auth/me
   POST   /api/upload/audio
   GET    /api/transcripts
   POST   /api/transcripts
   GET    /api/transcripts/:id
   PUT    /api/transcripts/:id
   DELETE /api/transcripts/:id

3. MIDDLEWARE:
   - JWT authentication
   - Request validation with Zod
   - File upload handling (multipart/form-data)
   - Error handling
   - CORS configuration
   - Rate limiting

4. FEATURES:
   - Secure file upload with validation
   - JWT-based authentication
   - Database integration with Prisma
   - Proper error handling and logging
   - TypeScript throughout

Set up a production-ready API server with proper security and error handling.
```

**Acceptance Criteria:**
- [ ] Fastify server with TypeScript configured
- [ ] All API endpoints implemented
- [ ] JWT authentication middleware working
- [ ] File upload handling implemented
- [ ] Database integration with Prisma
- [ ] Error handling and validation

---

## Task 5: Supabase Integration and Authentication

### Prompt for Claude Code:
```
Integrate Supabase for authentication and storage in VoiceFlow Pro.

PROJECT CONTEXT: Audio transcription platform requiring secure auth and file storage
REQUIREMENTS: User authentication, file storage, real-time features

IMPLEMENTATION TASKS:

1. SUPABASE CLIENT SETUP:
   - Configure Supabase client for frontend (apps/web/src/lib/supabase.ts)
   - Configure Supabase client for backend (apps/api/src/lib/supabase.ts)
   - Environment variables configuration
   - TypeScript types for Supabase

2. AUTHENTICATION COMPONENTS (Frontend):
   - Login form component
   - Registration form component
   - Password reset component
   - Auth context provider
   - Protected route wrapper
   - Auth state management

3. AUTHENTICATION API (Backend):
   - JWT token validation middleware
   - User session management
   - Password reset functionality
   - User profile endpoints

4. FILE STORAGE SETUP:
   - Audio file upload to Supabase Storage
   - Secure file access with RLS (Row Level Security)
   - File deletion and cleanup
   - Storage bucket configuration

5. AUTHENTICATION FLOW:
   - Email/password authentication
   - Session persistence
   - Automatic token refresh
   - Logout functionality

SECURITY REQUIREMENTS:
- Row Level Security (RLS) policies
- Secure file uploads with type validation
- JWT token validation
- Protected API endpoints
- CORS configuration

Create a complete authentication system with secure file storage capabilities.
```

**Acceptance Criteria:**
- [ ] Supabase client configured for both frontend and backend
- [ ] Authentication components created and working
- [ ] File upload to Supabase Storage implemented
- [ ] RLS policies configured for security
- [ ] JWT authentication middleware integrated
- [ ] Auth context and protected routes working

---

## Task 6: OpenAI Whisper API Integration

### Prompt for Claude Code:
```
Implement OpenAI Whisper API integration for audio transcription in VoiceFlow Pro.

PROJECT: Audio transcription service using OpenAI Whisper API
REQUIREMENTS: File transcription, real-time transcription, error handling, cost optimization

IMPLEMENTATION:

1. TRANSCRIPTION SERVICE (apps/api/src/services/transcription.ts):
   - OpenAI Whisper API client setup
   - Audio file preprocessing
   - Batch transcription for large files
   - Real-time transcription for live audio
   - Error handling and retries
   - Cost optimization strategies

2. AUDIO PROCESSING UTILITIES:
   - Audio format validation and conversion
   - File size optimization
   - Audio chunking for large files
   - Metadata extraction
   - Quality assessment

3. TRANSCRIPTION ENDPOINTS:
   POST /api/transcripts/upload     # Upload and transcribe file
   POST /api/transcripts/stream     # Real-time transcription
   GET  /api/transcripts/:id/status # Check transcription status
   GET  /api/transcripts/:id        # Get completed transcript

4. FEATURES TO IMPLEMENT:
   - Multi-language support
   - Speaker identification (basic)
   - Confidence scoring
   - Timestamp alignment
   - Progress tracking
   - Fallback mechanisms

5. ERROR HANDLING:
   - API rate limit handling
   - File format errors
   - Network timeouts
   - Cost limit protection
   - Graceful degradation

6. FRONTEND INTEGRATION:
   - Upload progress indicators
   - Real-time transcription display
   - Error state handling
   - Retry mechanisms

TECHNICAL REQUIREMENTS:
- Use OpenAI SDK for Node.js
- Implement proper TypeScript types
- Add comprehensive error handling
- Include progress callbacks
- Optimize for cost and performance

Create a robust transcription service that handles various audio formats and provides real-time feedback.
```

**Acceptance Criteria:**
- [ ] OpenAI Whisper API integration working
- [ ] File transcription endpoint implemented
- [ ] Audio preprocessing utilities created
- [ ] Error handling and retries implemented
- [ ] Progress tracking for long transcriptions
- [ ] Frontend integration for file uploads

---

## Task 7: Basic File Upload Pipeline

### Prompt for Claude Code:
```
Create a complete file upload pipeline for audio files in VoiceFlow Pro.

REQUIREMENTS: Secure file upload, format validation, storage, processing queue

IMPLEMENTATION:

1. FRONTEND UPLOAD COMPONENT (apps/web/src/components/audio/AudioUpload.tsx):
   - Drag and drop interface
   - File format validation (mp3, wav, m4a, ogg, opus, mov, mp4)
   - File size validation (max 2GB)
   - Upload progress indication
   - Preview audio before upload
   - Multiple file selection

2. BACKEND UPLOAD HANDLER (apps/api/src/routes/upload.ts):
   - Multipart file upload handling
   - File type validation
   - Virus scanning (basic)
   - File size limits
   - Storage to Supabase
   - Database record creation

3. FILE PROCESSING PIPELINE:
   - Audio metadata extraction
   - Format conversion if needed
   - File optimization
   - Queue for transcription processing
   - Progress tracking

4. STORAGE MANAGEMENT:
   - Organized file structure in Supabase Storage
   - Secure file access URLs
   - File cleanup policies
   - Backup strategies

5. UPLOAD FLOW:
   User selects file → Frontend validation → Upload to API → Store in Supabase → Create DB record → Queue for processing → Return upload status

6. ERROR HANDLING:
   - Invalid file formats
   - File too large
   - Upload interruptions
   - Storage failures
   - Network issues

COMPONENTS TO CREATE:
- AudioUpload.tsx (drag & drop component)
- UploadProgress.tsx (progress indicator)
- FileValidator utility
- StorageService class
- UploadQueue manager

Create a user-friendly upload experience with robust error handling and progress feedback.
```

**Acceptance Criteria:**
- [ ] Drag and drop file upload working
- [ ] File format and size validation implemented
- [ ] Upload progress indication functioning
- [ ] Files stored securely in Supabase Storage
- [ ] Database records created for uploads
- [ ] Error handling for various failure scenarios

---

## Task 8: Development Environment and Scripts

### Prompt for Claude Code:
```
Set up the complete development environment and automation scripts for VoiceFlow Pro.

PROJECT: Development tooling and environment setup for audio transcription platform
REQUIREMENTS: Easy setup, consistent development experience, automated workflows

IMPLEMENTATION:

1. DEVELOPMENT SCRIPTS (package.json in root):
   - npm run dev (start all services)
   - npm run build (build all packages)
   - npm run test (run all tests)
   - npm run lint (lint all code)
   - npm run format (format all code)
   - npm run db:push (update database)
   - npm run db:seed (seed database)

2. SETUP SCRIPT (scripts/setup.sh):
   - Install dependencies
   - Set up environment variables
   - Initialize database
   - Seed development data
   - Start development servers

3. ENVIRONMENT CONFIGURATION:
   - .env.example with all required variables
   - Environment validation
   - Development vs production configs
   - Secret management guidelines

4. DOCKER SETUP (optional but recommended):
   - Dockerfile for each service
   - docker-compose.yml for local development
   - Database container setup
   - Redis container for queues

5. VS CODE CONFIGURATION:
   - Workspace settings
   - Recommended extensions
   - Debug configurations
   - Code snippets

6. GIT HOOKS:
   - Pre-commit hooks for linting
   - Pre-push hooks for tests
   - Commit message validation
   - Automated formatting

DEVELOPER EXPERIENCE FEATURES:
- One-command setup for new developers
- Hot reload for all services
- Consistent code formatting
- Automated testing
- Clear error messages

Create a development environment that new team members can set up in under 5 minutes.
```

**Acceptance Criteria:**
- [ ] All development scripts working correctly
- [ ] One-command setup script functional
- [ ] Environment variables properly configured
- [ ] Hot reload working for frontend and backend
- [ ] Linting and formatting automated
- [ ] Database setup and seeding working

---

## Integration Testing Checklist

After completing all tasks, verify the following integration points:

### End-to-End Flow Test:
- [ ] User can register/login successfully
- [ ] User can upload an audio file
- [ ] File is stored in Supabase Storage
- [ ] Transcription is triggered via OpenAI API
- [ ] Transcript appears in user dashboard
- [ ] User can view and edit transcript

### Technical Integration Test:
- [ ] Frontend can communicate with backend API
- [ ] Backend can connect to database
- [ ] Authentication works across all endpoints
- [ ] File upload stores files correctly
- [ ] OpenAI API integration responds properly
- [ ] Error handling works in all components

### Performance Test:
- [ ] File upload handles large files (100MB+)
- [ ] API responses are under 2 seconds
- [ ] Database queries are optimized
- [ ] Memory usage is reasonable
- [ ] No memory leaks in development

---

## Week 1 Deliverables

By end of Week 1, the following should be complete and functional:

1. **Working monorepo** with all packages and proper TypeScript setup
2. **Database schema** with migrations and seed data
3. **Authentication system** with Supabase integration
4. **File upload pipeline** from frontend to storage
5. **Basic transcription** using OpenAI Whisper API
6. **Development environment** with one-command setup

**Success Criteria:**
- New developer can set up entire project in under 5 minutes
- Complete audio file upload and transcription flow works
- All TypeScript types are properly defined
- Basic UI allows file upload and transcript viewing
- Error handling covers major failure scenarios

---

## Notes for Claude Code Agent

**Code Quality Requirements:**
- Use TypeScript strict mode throughout
- Implement proper error handling for all async operations
- Add comprehensive JSDoc comments for public APIs
- Follow consistent naming conventions
- Include unit tests for utility functions

**Security Considerations:**
- Validate all user inputs
- Sanitize file uploads
- Use parameterized database queries
- Implement proper CORS policies
- Never expose sensitive environment variables

**Performance Guidelines:**
- Optimize database queries with proper indexes
- Implement file size limits and validation
- Use streaming for large file uploads
- Cache frequently accessed data
- Monitor API rate limits

Remember: This is Week 1 of a 4-week MVP. Focus on getting core functionality working reliably rather than advanced features. The goal is a solid foundation that can be built upon in subsequent weeks.