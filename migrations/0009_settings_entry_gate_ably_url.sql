-- 메인 페이지 진입 게이트용 에이블리 수익 링크 (관리자에서 변경)
ALTER TABLE settings ADD COLUMN entry_gate_ably_url TEXT NOT NULL DEFAULT 'https://applink.a-bly.com/p25459';
