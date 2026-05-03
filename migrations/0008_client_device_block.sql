-- 영구 정지 계정과 연결된 기기(클라이언트 ID) 재가입 차단
CREATE TABLE IF NOT EXISTS blocked_client_ids (
  client_id      TEXT PRIMARY KEY,
  created_at     INTEGER NOT NULL,
  source_user_id TEXT
);

CREATE TABLE IF NOT EXISTS user_client_bindings (
  user_id    TEXT NOT NULL,
  client_id  TEXT NOT NULL,
  bound_at   INTEGER NOT NULL,
  PRIMARY KEY (user_id, client_id),
  FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE INDEX IF NOT EXISTS idx_user_client_bindings_client ON user_client_bindings (client_id);
