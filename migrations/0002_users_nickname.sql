-- Rename login identifier from email to nickname (영/한/숫자 전용은 앱 레벨에서 검증)
ALTER TABLE users RENAME COLUMN email TO nickname;
