-- Row Level Security Policies for VoiceFlow Pro
-- Run this in your Supabase SQL editor after running Prisma migrations

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_shares ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Transcripts table policies
CREATE POLICY "Users can view own transcripts" ON transcripts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own transcripts" ON transcripts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transcripts" ON transcripts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transcripts" ON transcripts
  FOR DELETE USING (auth.uid() = user_id);

-- Shared transcripts access
CREATE POLICY "Users can view shared transcripts" ON transcripts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM transcript_shares
      WHERE transcript_id = transcripts.id
      AND shared_with_id = auth.uid()
      AND (expires_at IS NULL OR expires_at > NOW())
    )
  );

-- Transcript segments policies
CREATE POLICY "Users can view segments of own transcripts" ON transcript_segments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM transcripts
      WHERE transcripts.id = transcript_segments.transcript_id
      AND transcripts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view segments of shared transcripts" ON transcript_segments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM transcript_shares
      WHERE transcript_shares.transcript_id = transcript_segments.transcript_id
      AND transcript_shares.shared_with_id = auth.uid()
      AND (transcript_shares.expires_at IS NULL OR transcript_shares.expires_at > NOW())
    )
  );

CREATE POLICY "Users can update segments of own transcripts" ON transcript_segments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM transcripts
      WHERE transcripts.id = transcript_segments.transcript_id
      AND transcripts.user_id = auth.uid()
    )
  );

-- Comments policies
CREATE POLICY "Users can view comments on accessible transcripts" ON transcript_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM transcripts
      WHERE transcripts.id = transcript_comments.transcript_id
      AND (
        transcripts.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM transcript_shares
          WHERE transcript_shares.transcript_id = transcripts.id
          AND transcript_shares.shared_with_id = auth.uid()
          AND (transcript_shares.expires_at IS NULL OR transcript_shares.expires_at > NOW())
        )
      )
    )
  );

CREATE POLICY "Users can create comments on accessible transcripts" ON transcript_comments
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM transcripts
      WHERE transcripts.id = transcript_comments.transcript_id
      AND (
        transcripts.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM transcript_shares
          WHERE transcript_shares.transcript_id = transcripts.id
          AND transcript_shares.shared_with_id = auth.uid()
          AND transcript_shares.access_level IN ('COMMENT', 'EDIT')
          AND (transcript_shares.expires_at IS NULL OR transcript_shares.expires_at > NOW())
        )
      )
    )
  );

-- Storage policies
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