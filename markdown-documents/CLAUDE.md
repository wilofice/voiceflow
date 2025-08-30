# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VoiceFlow Pro is a cross-platform audio transcription platform designed to compete with MacWhisper. Currently in pre-development phase with comprehensive documentation for implementation.

## Repository Structure

```
voiceflow/
├── creation.md    # Product strategy and technical architecture
├── week_1.md      # Week 1 implementation guide with detailed tasks
└── CLAUDE.md      # This file
```

## Planned Technology Stack

### Frontend
- Next.js 14 with App Router
- React 18 with TypeScript
- Tailwind CSS + Radix UI
- Tauri for desktop apps (not Electron)

### Backend
- Node.js with Fastify framework
- TypeScript with strict mode
- tRPC for type-safe APIs
- PostgreSQL with Prisma ORM

### Infrastructure
- Supabase for auth and file storage
- OpenAI Whisper API for transcription
- Socket.io for real-time collaboration
- Vercel (frontend) + Railway (backend)

## Development Commands (Once Implemented)

### Monorepo Structure
```bash
# Install dependencies for all packages
npm install

# Development mode
npm run dev          # Runs all services concurrently
npm run dev:web      # Frontend only
npm run dev:api      # Backend only

# Building
npm run build        # Build all packages
npm run build:web    # Build frontend
npm run build:api    # Build backend

# Testing
npm run test         # Run all tests
npm run test:unit    # Unit tests only
npm run test:e2e     # E2E tests
npm run test:watch   # Watch mode

# Linting and formatting
npm run lint         # ESLint check
npm run lint:fix     # Auto-fix issues
npm run format       # Prettier format
npm run typecheck    # TypeScript check
```

## Architecture Guidelines

### API Design
- RESTful endpoints with tRPC for type safety
- File operations through /api/files/*
- Transcription through /api/transcriptions/*
- Real-time updates via WebSocket events

### Database Schema
Key entities (as planned):
- Users (Supabase Auth integrated)
- Transcriptions (with segments)
- Files (metadata only, files in Supabase Storage)
- Projects (for organization)
- Teams & TeamMembers (collaboration)

### File Upload Pipeline
1. Client validates file (size, format)
2. Upload to Supabase Storage
3. Create database record
4. Queue for transcription
5. Process with Whisper API
6. Store results and notify user

### Security Considerations
- Row Level Security (RLS) in PostgreSQL
- JWT tokens for authentication
- File access through signed URLs
- Input validation at all layers
- Rate limiting on API endpoints

## Implementation Status

Currently in planning phase. Use week_1.md as the implementation guide for initial setup tasks:
1. Repository and monorepo setup
2. Database schema design
3. Next.js application scaffold
4. Backend API setup
5. Supabase integration
6. Whisper API integration
7. File upload pipeline
8. Development environment

## Key Development Principles

1. **Type Safety**: Use TypeScript strict mode throughout
2. **API First**: Design APIs before implementing UI
3. **Real-time First**: Build with collaboration in mind
4. **Cross-platform**: Ensure all features work on web and desktop
5. **Performance**: Optimize for large audio files and long transcriptions
6. **Privacy**: User data isolation and encryption where needed