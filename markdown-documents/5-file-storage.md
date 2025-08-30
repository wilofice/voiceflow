# Task 5: Add File Storage and Persistence

## Input
- Audio files uploaded by users
- Supabase Storage configuration

## Output
- Persistent storage of audio files in Supabase Storage
- Audio file URLs linked to transcripts

## Guidelines
- Integrate Supabase Storage for file uploads
- Store file metadata in DB (size, duration, user, transcript)
- Secure files with RLS and signed URLs
- Clean up files on transcript deletion
- UI: show audio file status and download link

## Functional Tests Validation
- [ ] Upload audio file and verify in Supabase Storage
- [ ] File URL accessible only to owner (mock: signed URL)
- [ ] File metadata correct in DB
- [ ] File deleted when transcript deleted
- [ ] UI shows file status and allows download
- [ ] Error shown if upload fails

## Unit Testing Guidelines
- Test file upload/download logic
- Test RLS and signed URL generation
- Test DB/file consistency on create/delete
- Test UI for file status and download
