-- 공지 (제목·본문·작성 시각 자동 기록)
CREATE TABLE IF NOT EXISTS announcements (
  id         TEXT    PRIMARY KEY,
  title      TEXT    NOT NULL,
  body       TEXT    NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements (created_at);
