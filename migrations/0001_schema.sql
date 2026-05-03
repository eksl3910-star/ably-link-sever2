-- ====================================================
-- ably-link-server  |  migration 0001 — initial schema
-- ====================================================

-- Global configuration (single row, key='global')
CREATE TABLE IF NOT EXISTS settings (
  key                  TEXT    PRIMARY KEY,
  maintenance_on       INTEGER NOT NULL DEFAULT 0,
  touched_at           INTEGER NOT NULL,
  maintenance_message  TEXT    NOT NULL DEFAULT ''
);

INSERT OR IGNORE INTO settings (key, maintenance_on, touched_at, maintenance_message)
  VALUES ('global', 0, (unixepoch() * 1000), '');

-- Registered users
CREATE TABLE IF NOT EXISTS users (
  id        TEXT    PRIMARY KEY,
  nickname  TEXT    NOT NULL UNIQUE,
  pw_hash   TEXT    NOT NULL,
  pw_salt   TEXT    NOT NULL,
  joined_at INTEGER NOT NULL
);

-- Active sessions
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT    PRIMARY KEY,
  user_id     TEXT    NOT NULL,
  valid_until INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry  ON sessions (valid_until);

-- Link pool  (state: 'queued' | 'claimed' | 'consumed')
CREATE TABLE IF NOT EXISTS links (
  id              TEXT    PRIMARY KEY,
  url             TEXT    NOT NULL,
  owner_id        TEXT    NOT NULL,
  state           TEXT    NOT NULL DEFAULT 'queued',
  queue_pos       INTEGER NOT NULL,   -- lower = earlier in queue
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,

  taker_id        TEXT,
  claim_deadline  INTEGER,
  claimed_at      INTEGER,
  consumed_at     INTEGER,

  FOREIGN KEY (owner_id) REFERENCES users (id)
);

CREATE INDEX IF NOT EXISTS idx_links_queue   ON links (state, queue_pos);
CREATE INDEX IF NOT EXISTS idx_links_owner   ON links (owner_id, state);
CREATE INDEX IF NOT EXISTS idx_links_taker   ON links (taker_id, state);

-- Prevent a user from receiving the same owner's link twice
CREATE TABLE IF NOT EXISTS receipts (
  link_id    TEXT    NOT NULL,
  taker_id   TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (link_id, taker_id),
  FOREIGN KEY (link_id)  REFERENCES links (id),
  FOREIGN KEY (taker_id) REFERENCES users (id)
);
