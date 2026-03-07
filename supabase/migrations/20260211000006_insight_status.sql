-- Add status column to insights for ack/resolve workflow
-- Maps: active (new) -> acknowledged (seen, working on it) -> resolved (done)
ALTER TABLE insights
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'acknowledged', 'resolved'));

-- Backfill: dismissed insights become resolved
UPDATE insights SET status = 'resolved' WHERE is_dismissed = true;

CREATE INDEX idx_insights_status ON insights(status) WHERE status != 'resolved';
