CREATE TABLE IF NOT EXISTS evaluations (
  id TEXT PRIMARY KEY,
  evaluator_name TEXT NOT NULL,
  group_id TEXT NOT NULL,
  ratings_json TEXT NOT NULL,
  total_cents INTEGER NOT NULL CHECK (total_cents BETWEEN 0 AND 800),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS evaluations_group_id_idx ON evaluations (group_id);
