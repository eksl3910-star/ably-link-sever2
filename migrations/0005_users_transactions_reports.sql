-- ====================================================
-- migration 0005 — 사용자 링크/페널티, 거래(transactions), 신고(reports)
-- ====================================================

ALTER TABLE users ADD COLUMN link TEXT;
ALTER TABLE users ADD COLUMN last_link_update INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN penalty_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN ban_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN ban_until INTEGER;
ALTER TABLE users ADD COLUMN account_status TEXT NOT NULL DEFAULT 'active';

CREATE TABLE IF NOT EXISTS transactions (
  id          TEXT    PRIMARY KEY,
  link_id     TEXT    NOT NULL,

  user_a_id   TEXT    NOT NULL,
  user_b_id   TEXT    NOT NULL,

  url_a       TEXT    NOT NULL,
  url_b       TEXT    NOT NULL,

  status      TEXT    NOT NULL DEFAULT 'pending',

  a_joined_at INTEGER,
  b_joined_at INTEGER,
  a_clicked_at INTEGER,
  b_clicked_at INTEGER,

  created_at  INTEGER NOT NULL,

  FOREIGN KEY (link_id)   REFERENCES links (id),
  FOREIGN KEY (user_a_id) REFERENCES users (id),
  FOREIGN KEY (user_b_id) REFERENCES users (id)
);

CREATE INDEX IF NOT EXISTS idx_transactions_link ON transactions (link_id);
CREATE INDEX IF NOT EXISTS idx_transactions_users ON transactions (user_a_id, user_b_id);

CREATE TABLE IF NOT EXISTS reports (
  id          TEXT    PRIMARY KEY,
  reporter_id TEXT    NOT NULL,
  target_id   TEXT    NOT NULL,
  reason      TEXT    NOT NULL,
  created_at  INTEGER NOT NULL,
  FOREIGN KEY (reporter_id) REFERENCES users (id),
  FOREIGN KEY (target_id)   REFERENCES users (id)
);

CREATE INDEX IF NOT EXISTS idx_reports_target ON reports (target_id);
