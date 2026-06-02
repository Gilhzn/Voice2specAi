-- Voice2Spec AI — PostgreSQL schema.
-- Transcripts and specs are stored encrypted (AES-256-GCM, per-user key) in the
-- `payload` columns; only non-sensitive metadata is stored in clear.

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  state           TEXT NOT NULL DEFAULT 'idle',
  zero_retention  BOOLEAN NOT NULL DEFAULT false,
  segment_count   INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- One row per finalized transcript segment. `payload` is the encrypted segment.
CREATE TABLE IF NOT EXISTS transcripts (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  seq         INTEGER NOT NULL,
  payload     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transcripts_session_id ON transcripts(session_id);

-- Generated specification documents. `payload` is the encrypted Markdown body.
CREATE TABLE IF NOT EXISTS specs (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  model       TEXT NOT NULL,
  payload     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_specs_session_id ON specs(session_id);
