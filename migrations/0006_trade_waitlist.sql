-- 거래 대기 명단 / 거래 매칭 큐 (링크 큐 업로드 없이 1:1 매칭용)

CREATE TABLE IF NOT EXISTS trade_waitlist (
  user_id    TEXT PRIMARY KEY,
  joined_at  INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS trade_match_queue (
  user_id       TEXT PRIMARY KEY,
  requested_at  INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE INDEX IF NOT EXISTS idx_trade_match_requested ON trade_match_queue (requested_at);
