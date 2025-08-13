-- Update RLS Policies for Whisper Integration
-- Date: 2025-01-13
-- Description: Adds RLS policies for UserPreferences table

-- Enable RLS on UserPreferences table
ALTER TABLE "UserPreferences" ENABLE ROW LEVEL SECURITY;

-- UserPreferences table policies
CREATE POLICY "Users can view own preferences" ON "UserPreferences"
  FOR SELECT USING (auth.uid()::text = "userId"::text);

CREATE POLICY "Users can create own preferences" ON "UserPreferences"
  FOR INSERT WITH CHECK (auth.uid()::text = "userId"::text);

CREATE POLICY "Users can update own preferences" ON "UserPreferences"
  FOR UPDATE USING (auth.uid()::text = "userId"::text);

CREATE POLICY "Users can delete own preferences" ON "UserPreferences"
  FOR DELETE USING (auth.uid()::text = "userId"::text);

-- Comment on policies
COMMENT ON POLICY "Users can view own preferences" ON "UserPreferences" IS 'Users can only view their own transcription preferences';
COMMENT ON POLICY "Users can create own preferences" ON "UserPreferences" IS 'Users can only create preferences for themselves';
COMMENT ON POLICY "Users can update own preferences" ON "UserPreferences" IS 'Users can only update their own preferences';
COMMENT ON POLICY "Users can delete own preferences" ON "UserPreferences" IS 'Users can only delete their own preferences';