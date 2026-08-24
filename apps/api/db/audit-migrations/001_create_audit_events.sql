CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  request_id TEXT NOT NULL,
  booking_id TEXT,
  experiment_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_request_id_created_at
  ON audit_events (request_id, created_at);

CREATE INDEX IF NOT EXISTS audit_events_booking_id_created_at
  ON audit_events (booking_id, created_at);
