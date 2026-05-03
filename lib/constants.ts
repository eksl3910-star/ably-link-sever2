// Session cookie — 이 포크 전용 이름(다른 프로젝트와 같은 브라우저에서 쿠키 섞임 방지)
export const SESSION_COOKIE = "als_sever2_token";

// Session validity: 14 days (로그인 유지 체크 시)
export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

// 로그인 유지 미체크: 브라우저 닫으면 쿠키 삭제 + 서버 세션도 짧게
export const SESSION_TTL_SHORT_MS = 24 * 60 * 60 * 1000;

// Claim window for a received link (맞교 창 · 서버 클레임 만료)
export const CLAIM_WINDOW_MS = 15_000;

// Only URLs ending with this hostname are accepted
export const ABLY_HOSTNAME = "a-bly.com";

/** 메인 진입 게이트 버튼 기본 링크 (DB 마이그레이션 전·실패 시 사용) */
export const DEFAULT_ENTRY_GATE_ABLY_URL = "https://applink.a-bly.com/p25459";

// PBKDF2 iteration count
export const PBKDF2_ITERATIONS = 100_000;

// Admin password env key (checked in order)
export const ADMIN_PASS_ENVS = ["ADMIN_TOGGLE_PASS", "ADMIN_BASIC_PASS"] as const;

/** Basic 통과 후 RSC 요청 등에 쓰는 관리자 게이트 쿠키 (httpOnly) */
export const ADMIN_GATE_COOKIE = "als_sever2_admin_gate";
