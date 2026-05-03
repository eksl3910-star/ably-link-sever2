-- =============================================================================
-- abiy-link-sever2 — 통합 D1 스키마 (에이블리 링크 교환 · 거래 · 신고)
-- 다른 프로젝트(ably-link-server 등)와 같은 D1 인스턴스를 공유하지 마세요.
-- 신규 DB 또는 문서용 전체 정의. 기존 배포는 migrations/*.sql 순서로 적용.
-- =============================================================================

PRAGMA foreign_keys = ON;

-- --- 설정 --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS settings (
  key                  TEXT    PRIMARY KEY,
  maintenance_on       INTEGER NOT NULL DEFAULT 0,
  touched_at           INTEGER NOT NULL,
  maintenance_message  TEXT    NOT NULL DEFAULT ''
);

INSERT OR IGNORE INTO settings (key, maintenance_on, touched_at, maintenance_message)
  VALUES ('global', 0, (unixepoch() * 1000), '');

-- --- 사용자 ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id              TEXT    PRIMARY KEY,
  nickname        TEXT    NOT NULL UNIQUE,
  pw_hash         TEXT    NOT NULL,
  pw_salt         TEXT    NOT NULL,
  joined_at       INTEGER NOT NULL,

  -- 당일 에이블리 프로필 링크 (KST 자정 Cron으로 초기화)
  link                      TEXT,
  last_link_update          INTEGER NOT NULL DEFAULT 0,

  penalty_count             INTEGER NOT NULL DEFAULT 0,
  ban_count                 INTEGER NOT NULL DEFAULT 0,
  ban_until                 INTEGER,
  account_status            TEXT    NOT NULL DEFAULT 'active'
);

-- account_status: 'active' | 'permanent_ban'

-- --- 세션 --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT    PRIMARY KEY,
  user_id     TEXT    NOT NULL,
  valid_until INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry  ON sessions (valid_until);

-- --- 링크 풀 (대기열 · 클레임) ------------------------------------------------

CREATE TABLE IF NOT EXISTS links (
  id              TEXT    PRIMARY KEY,
  url             TEXT    NOT NULL,
  owner_id        TEXT    NOT NULL,
  state           TEXT    NOT NULL DEFAULT 'queued',
  queue_pos       INTEGER NOT NULL,
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

CREATE TABLE IF NOT EXISTS receipts (
  link_id    TEXT    NOT NULL,
  taker_id   TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (link_id, taker_id),
  FOREIGN KEY (link_id)  REFERENCES links (id),
  FOREIGN KEY (taker_id) REFERENCES users (id)
);

-- --- 거래 (1:1, 상태 + 조인/클릭 시각) ----------------------------------------

CREATE TABLE IF NOT EXISTS transactions (
  id          TEXT    PRIMARY KEY,
  link_id     TEXT    NOT NULL,

  user_a_id   TEXT    NOT NULL,
  user_b_id   TEXT    NOT NULL,

  url_a       TEXT    NOT NULL,
  url_b       TEXT    NOT NULL,

  -- pending | a_clicked | b_clicked | completed
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

-- --- 신고 --------------------------------------------------------------------

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

-- --- 공지 --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS announcements (
  id         TEXT    PRIMARY KEY,
  title      TEXT    NOT NULL,
  body       TEXT    NOT NULL,
  created_at INTEGER NOT NULL
);
