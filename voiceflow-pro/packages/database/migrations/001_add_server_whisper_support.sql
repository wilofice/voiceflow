-- Migration: Add server-side Whisper processing support
-- Date: 2025-01-13
-- Description: Adds transcription method tracking, processing location, 
-- performance stats, and user preferences for Whisper integration

-- Create new enum types
CREATE TYPE "TranscriptionMethod" AS ENUM ('OPENAI', 'WHISPER_LOCAL', 'WHISPER_DOCKER');
CREATE TYPE "ProcessingLocation" AS ENUM ('CLOUD', 'LOCAL', 'CONTAINER');

-- Add new columns to Transcript table
ALTER TABLE "Transcript" 
ADD COLUMN "transcriptionMethod" "TranscriptionMethod" DEFAULT 'OPENAI' NOT NULL,
ADD COLUMN "whisperModel" TEXT,
ADD COLUMN "processingLocation" "ProcessingLocation" DEFAULT 'CLOUD' NOT NULL,
ADD COLUMN "processingStats" JSONB;

-- Create indexes for new columns
CREATE INDEX "Transcript_transcriptionMethod_idx" ON "Transcript"("transcriptionMethod");
CREATE INDEX "Transcript_processingLocation_idx" ON "Transcript"("processingLocation");
CREATE INDEX "Transcript_userId_transcriptionMethod_idx" ON "Transcript"("userId", "transcriptionMethod");

-- Create UserPreferences table
CREATE TABLE "UserPreferences" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL UNIQUE,
    "defaultTranscriptionMethod" "TranscriptionMethod" NOT NULL DEFAULT 'OPENAI',
    "defaultWhisperModel" TEXT NOT NULL DEFAULT 'base',
    "autoDownloadModels" BOOLEAN NOT NULL DEFAULT false,
    "privacyMode" BOOLEAN NOT NULL DEFAULT false,
    "preferredProcessingLocation" "ProcessingLocation" NOT NULL DEFAULT 'CLOUD',
    "maxFileSize" INTEGER NOT NULL DEFAULT 500,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "UserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create index for UserPreferences
CREATE INDEX "UserPreferences_userId_idx" ON "UserPreferences"("userId");

-- Update existing transcripts to have default values
UPDATE "Transcript" 
SET 
    "transcriptionMethod" = 'OPENAI',
    "processingLocation" = 'CLOUD'
WHERE 
    "transcriptionMethod" IS NULL 
    OR "processingLocation" IS NULL;

-- Create trigger to automatically update updatedAt on UserPreferences
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_preferences_updated_at 
    BEFORE UPDATE ON "UserPreferences" 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comment on new columns for documentation
COMMENT ON COLUMN "Transcript"."transcriptionMethod" IS 'Method used for transcription (OpenAI API, local Whisper, or Docker Whisper)';
COMMENT ON COLUMN "Transcript"."whisperModel" IS 'Whisper model used (tiny, base, small, medium, large) - only applicable for Whisper methods';
COMMENT ON COLUMN "Transcript"."processingLocation" IS 'Where the processing occurred (cloud, local machine, or container)';
COMMENT ON COLUMN "Transcript"."processingStats" IS 'JSON object containing processing time, cost, quality score, resource usage, and error information';

COMMENT ON TABLE "UserPreferences" IS 'User-specific preferences for transcription methods and Whisper settings';
COMMENT ON COLUMN "UserPreferences"."defaultTranscriptionMethod" IS 'Users preferred transcription method';
COMMENT ON COLUMN "UserPreferences"."defaultWhisperModel" IS 'Default Whisper model to use for transcription';
COMMENT ON COLUMN "UserPreferences"."autoDownloadModels" IS 'Whether to automatically download Whisper models when needed';
COMMENT ON COLUMN "UserPreferences"."privacyMode" IS 'When enabled, prefer local processing over cloud services';
COMMENT ON COLUMN "UserPreferences"."preferredProcessingLocation" IS 'Users preferred processing location';
COMMENT ON COLUMN "UserPreferences"."maxFileSize" IS 'Maximum file size in MB that user wants to process locally';