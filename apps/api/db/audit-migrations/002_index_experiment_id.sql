CREATE INDEX IF NOT EXISTS audit_events_experiment_id_created_at_idx
  ON audit_events (experiment_id, created_at);
