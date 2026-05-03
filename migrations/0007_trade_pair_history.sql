-- 이미 1:1 매칭된 유저 쌍은 다시 매칭되지 않도록 기록
CREATE TABLE IF NOT EXISTS trade_pair_history (
  user_low   TEXT NOT NULL,
  user_high  TEXT NOT NULL,
  matched_at INTEGER NOT NULL,
  PRIMARY KEY (user_low, user_high)
);
