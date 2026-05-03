-- 이전 버전은 ALTER ADD COLUMN 이었는데, 이미 컬럼이 있는 DB에서 `migrations apply` 시
-- duplicate column 오류로 이후 마이그레이션(공지 테이블 등)이 적용되지 않았습니다.
-- 컬럼 추가는 0001 스키마에 포함되었거나, 예전에 ALTER로 이미 반영된 상태입니다.
-- 이 파일은 마이그레이션 기록만 맞추는 no-op 입니다.
SELECT 1;
