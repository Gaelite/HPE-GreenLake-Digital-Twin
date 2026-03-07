-- Add read tracking to insights table
ALTER TABLE insights ADD COLUMN read_at TIMESTAMPTZ DEFAULT NULL;

-- Partial index to optimize unread count queries
CREATE INDEX idx_insights_unread ON insights(created_at DESC)
  WHERE read_at IS NULL AND is_dismissed = false;

-- Fix missing UPDATE policy (dismiss was silently broken)
CREATE POLICY "Authenticated update insights" ON insights
  FOR UPDATE USING (auth.uid() IS NOT NULL);
