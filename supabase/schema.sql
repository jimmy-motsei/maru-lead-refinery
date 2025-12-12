-- Add processing queue table for async job handling
CREATE TABLE IF NOT EXISTS processing_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Status tracking
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Payload
  payload JSONB NOT NULL,
  
  -- Error tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  
  -- Result
  result JSONB
);

-- Add failed_syncs table for retry logic
CREATE TABLE IF NOT EXISTS failed_syncs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  integration VARCHAR(50) NOT NULL, -- 'hubspot', 'whatsapp'
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_processing_queue_status ON processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_processing_queue_next_retry ON processing_queue(next_retry_at);
CREATE INDEX IF NOT EXISTS idx_failed_syncs_resolved ON failed_syncs(resolved);
CREATE INDEX IF NOT EXISTS idx_failed_syncs_next_retry ON failed_syncs(next_retry_at);

-- Update trigger for processing_queue
CREATE TRIGGER update_processing_queue_updated_at
  BEFORE UPDATE ON processing_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add auto-reply tracking to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS auto_reply_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS auto_reply_sent_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS auto_reply_error TEXT;
