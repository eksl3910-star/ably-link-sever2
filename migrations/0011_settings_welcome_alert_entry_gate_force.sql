-- 환영 페이지 긴급 안내 문구, 메인 진입 게이트 관리자 강제 재표시 타임스탬프(ms)
ALTER TABLE settings ADD COLUMN welcome_alert_message TEXT NOT NULL DEFAULT '';
ALTER TABLE settings ADD COLUMN entry_gate_force_at INTEGER NOT NULL DEFAULT 0;
