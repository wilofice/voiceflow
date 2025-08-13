-- Rollback Migration: Remove server-side Whisper processing support
-- Date: 2025-01-13
-- Description: Removes transcription method tracking, processing location, 
-- performance stats, and user preferences for Whisper integration

-- Drop UserPreferences table
DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON "UserPreferences";
DROP TABLE IF EXISTS "UserPreferences";

-- Drop indexes for Transcript table
DROP INDEX IF EXISTS "Transcript_transcriptionMethod_idx";
DROP INDEX IF EXISTS "Transcript_processingLocation_idx";
DROP INDEX IF EXISTS "Transcript_userId_transcriptionMethod_idx";

-- Remove columns from Transcript table
ALTER TABLE "Transcript" 
DROP COLUMN IF EXISTS "transcriptionMethod",
DROP COLUMN IF EXISTS "whisperModel",
DROP COLUMN IF EXISTS "processingLocation",
DROP COLUMN IF EXISTS "processingStats";

-- Drop enum types
DROP TYPE IF EXISTS "TranscriptionMethod";
DROP TYPE IF EXISTS "ProcessingLocation";

-- Drop the trigger function
DROP FUNCTION IF EXISTS update_updated_at_column();