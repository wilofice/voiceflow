-- Row Level Security Policies for VoiceFlow Pro
-- Run this in your Supabase SQL editor after running Prisma migrations

-- Enable RLS on all tables (using Prisma's default table names)
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Transcript" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TranscriptSegment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TranscriptComment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TranscriptShare" ENABLE ROW LEVEL SECURITY;

-- User table policies
CREATE POLICY "Users can view own profile" ON "User"
  FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update own profile" ON "User"
  FOR UPDATE USING (auth.uid()::text = id::text);

-- Transcript table policies
CREATE POLICY "Users can view own transcripts" ON "Transcript"
  FOR SELECT USING (auth.uid()::text = "userId"::text);

CREATE POLICY "Users can create own transcripts" ON "Transcript"
  FOR INSERT WITH CHECK (auth.uid()::text = "userId"::text);

CREATE POLICY "Users can update own transcripts" ON "Transcript"
  FOR UPDATE USING (auth.uid()::text = "userId"::text);

CREATE POLICY "Users can delete own transcripts" ON "Transcript"
  FOR DELETE USING (auth.uid()::text = "userId"::text);

-- Shared transcripts access
CREATE POLICY "Users can view shared transcripts" ON "Transcript"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "TranscriptShare"
      WHERE "transcriptId" = "Transcript".id
      AND "sharedWithId"::text = auth.uid()::text
      AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
    )
  );

-- TranscriptSegment policies
CREATE POLICY "Users can view segments of own transcripts" ON "TranscriptSegment"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "Transcript"
      WHERE "Transcript".id = "TranscriptSegment"."transcriptId"
      AND "Transcript"."userId"::text = auth.uid()::text
    )
  );

CREATE POLICY "Users can view segments of shared transcripts" ON "TranscriptSegment"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "TranscriptShare"
      WHERE "TranscriptShare"."transcriptId" = "TranscriptSegment"."transcriptId"
      AND "TranscriptShare"."sharedWithId"::text = auth.uid()::text
      AND ("TranscriptShare"."expiresAt" IS NULL OR "TranscriptShare"."expiresAt" > NOW())
    )
  );

CREATE POLICY "Users can update segments of own transcripts" ON "TranscriptSegment"
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM "Transcript"
      WHERE "Transcript".id = "TranscriptSegment"."transcriptId"
      AND "Transcript"."userId"::text = auth.uid()::text
    )
  );

-- TranscriptComment policies
CREATE POLICY "Users can view comments on accessible transcripts" ON "TranscriptComment"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "Transcript"
      WHERE "Transcript".id = "TranscriptComment"."transcriptId"
      AND (
        "Transcript"."userId"::text = auth.uid()::text
        OR EXISTS (
          SELECT 1 FROM "TranscriptShare"
          WHERE "TranscriptShare"."transcriptId" = "Transcript".id
          AND "TranscriptShare"."sharedWithId"::text = auth.uid()::text
          AND ("TranscriptShare"."expiresAt" IS NULL OR "TranscriptShare"."expiresAt" > NOW())
        )
      )
    )
  );

CREATE POLICY "Users can create comments on accessible transcripts" ON "TranscriptComment"
  FOR INSERT WITH CHECK (
    auth.uid()::text = "userId"::text
    AND EXISTS (
      SELECT 1 FROM "Transcript"
      WHERE "Transcript".id = "TranscriptComment"."transcriptId"
      AND (
        "Transcript"."userId"::text = auth.uid()::text
        OR EXISTS (
          SELECT 1 FROM "TranscriptShare"
          WHERE "TranscriptShare"."transcriptId" = "Transcript".id
          AND "TranscriptShare"."sharedWithId"::text = auth.uid()::text
          AND "TranscriptShare"."accessLevel" IN ('COMMENT', 'EDIT')
          AND ("TranscriptShare"."expiresAt" IS NULL OR "TranscriptShare"."expiresAt" > NOW())
        )
      )
    )
  );

-- Storage policies remain the same
CREATE POLICY "Users can upload to own folder" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'audio-files' AND
    auth.uid()::text = (string_to_array(name, '/'))[1]
  );

CREATE POLICY "Users can view own files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'audio-files' AND
    auth.uid()::text = (string_to_array(name, '/'))[1]
  );

CREATE POLICY "Users can delete own files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'audio-files' AND
    auth.uid()::text = (string_to_array(name, '/'))[1]
  );