# Task 2: Build Transcript Management System

## Input
- Database schema (Prisma/Supabase)
- API endpoints for CRUD
- UI for transcript listing, editing, and export

## Output
- Transcripts table and segments table in DB
- CRUD API endpoints for transcripts
- UI for listing, searching, editing, and exporting transcripts

## Guidelines
- Use Prisma or Supabase for schema: transcripts, segments, files
- Implement REST or tRPC endpoints for CRUD
- Integrate Supabase Storage for audio files
- UI: transcript list, search/filter, editor, export (SRT/VTT/DOCX/PDF/TXT)
- Add sharing and organization features (folders, tags)

## Functional Tests Validation
- [ ] Create, update, delete transcript via API (mock: POST/PUT/DELETE)
- [ ] List transcripts for user, search by keyword
- [ ] Export transcript to SRT, VTT, DOCX, PDF, TXT (mock: 1-min transcript)
- [ ] Share transcript via public/private link
- [ ] Audio file persists in Supabase Storage
- [ ] UI updates in real time after CRUD

## Unit Testing Guidelines
- Test DB schema migrations and constraints
- Test API endpoint logic and error handling
- Test file upload/download to Supabase Storage
- Test UI state for CRUD and export actions
