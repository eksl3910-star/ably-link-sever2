-- 메인 진입 게이트(에이블리 링크 확인) ON/OFF (0 = 끔, 1 = 켬)
ALTER TABLE settings ADD COLUMN entry_gate_enabled INTEGER NOT NULL DEFAULT 1;
