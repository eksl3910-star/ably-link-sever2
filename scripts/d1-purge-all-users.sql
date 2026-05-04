-- users 및 사용자 종속 데이터 일괄 삭제 (공지·설정·blocked_client_ids 유지)
-- 로컬/원격 D1: wrangler d1 execute <DB_NAME> --remote --file=scripts/d1-purge-all-users.sql
-- 관리자 화면의 「모든 유저·연관 데이터 삭제」와 동일한 순서입니다.

DELETE FROM transactions;
DELETE FROM receipts;
DELETE FROM links;
DELETE FROM reports;
DELETE FROM sessions;
DELETE FROM trade_waitlist;
DELETE FROM trade_match_queue;
DELETE FROM trade_pair_history;
DELETE FROM user_client_bindings;
DELETE FROM users;
