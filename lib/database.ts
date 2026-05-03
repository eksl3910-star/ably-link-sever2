import { getRequestContext, getOptionalRequestContext } from "@cloudflare/next-on-pages";
import { DEFAULT_ENTRY_GATE_ABLY_URL, SESSION_TTL_MS, CLAIM_WINDOW_MS } from "@/lib/constants";
import { parseAndValidateAblyUrl } from "@/lib/ably-link";
import { getKstDayStartMs } from "@/lib/kst";

// ── Types ─────────────────────────────────────────────────────────────────────

export type User = {
  id: string;
  nickname: string;
  joinedAt: number;
};

export type SessionRow = {
  id: string;
  userId: string;
  validUntil: number;
};

export type LinkState = "queued" | "claimed" | "consumed";

export type LinkRow = {
  id: string;
  url: string;
  ownerId: string;
  state: LinkState;
  queuePos: number;
  createdAt: number;
  updatedAt: number;
  takerId: string | null;
  claimDeadline: number | null;
  claimedAt: number | null;
  consumedAt: number | null;
};

export type AdminMetrics = {
  totalUsers: number;
  newUsersToday: number;
  totalLinks: number;
  queuedLinks: number;
  consumedLinks: number;
};

// ── DB access ─────────────────────────────────────────────────────────────────

type D1Env = { DB?: D1Database };

/** D1Database는 보통 prepare + exec 를 가짐 (다른 CF 바인딩과 구분) */
function isD1Database(v: unknown): v is D1Database {
  if (typeof v !== "object" || v === null) return false;
  const o = v as { prepare?: unknown; exec?: unknown };
  return typeof o.prepare === "function" && typeof o.exec === "function";
}

/** 허용된 바인딩 이름만 조회 (임의 auto-scan 금지) */
function pickD1FromEnv(env: unknown): D1Database | undefined {
  if (!env || typeof env !== "object") return undefined;
  const record = env as Record<string, unknown>;
  const candidates = ["DB", "D1_DB", "DATABASE", "D1"];
  for (const key of candidates) {
    const value = record[key];
    if (isD1Database(value)) return value;
  }
  return undefined;
}

export function getDb(): D1Database {
  let env: unknown;
  try {
    env = getRequestContext().env;
  } catch {
    env = undefined;
  }

  let db = pickD1FromEnv(env);
  if (!db) {
    const g = globalThis as unknown as { DB?: unknown };
    if (isD1Database(g.DB)) db = g.DB;
  }

  if (!db) {
    throw new Error(
      "D1 binding을 찾지 못했거나 잘못된 바인딩을 참조했습니다. Cloudflare에서 이 프로젝트 전용 D1을 만들고, Functions → D1 bindings 에 이름 `DB`로 연결한 뒤 재배포하세요. (다른 저장소와 같은 database_id를 쓰지 마세요.)"
    );
  }
  return db;
}

/** 기존 DB는 `email`, 신규 스키마는 `nickname` — 둘 다 지원 */
type UsersLoginCol = "nickname" | "email";
let cachedUsersLoginCol: UsersLoginCol | undefined;

export async function getUsersLoginColumn(db: D1Database): Promise<UsersLoginCol> {
  if (cachedUsersLoginCol) return cachedUsersLoginCol;
  const res = await db.prepare("PRAGMA table_info(users)").all<{ name: string }>();
  const names = new Set((res.results ?? []).map((r) => r.name));
  if (names.has("nickname")) cachedUsersLoginCol = "nickname";
  else if (names.has("email")) cachedUsersLoginCol = "email";
  else {
    throw new Error("users 테이블에 nickname 또는 email 컬럼이 없습니다. 마이그레이션을 확인하세요.");
  }
  return cachedUsersLoginCol;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** 영문 대문자만 소문자로 통일 (한글·숫자는 그대로). */
export function normalizeNickname(raw: string): string {
  return raw.trim().replace(/[A-Z]/g, (c) => c.toLowerCase());
}

/** 특수문자 제외: 영어, 한글(음절·자모), 숫자만 허용. */
const NICKNAME_CHARS = /^[a-z0-9\uAC00-\uD7A3\u3131-\u318E]+$/;

export function validateNicknameRules(normalized: string): string | null {
  if (normalized.length < 2) return "닉네임은 2자 이상이어야 합니다.";
  if (normalized.length > 20) return "닉네임은 20자 이하여야 합니다.";
  if (!NICKNAME_CHARS.test(normalized)) {
    return "닉네임은 영어, 한글, 숫자만 사용할 수 있습니다.";
  }
  return null;
}

// ── User ──────────────────────────────────────────────────────────────────────

export async function insertUser(
  nickname: string,
  pwHash: string,
  pwSalt: string
): Promise<User> {
  const db = getDb();
  const col = await getUsersLoginColumn(db);
  const now = Date.now();
  const id = crypto.randomUUID();
  const normalized = normalizeNickname(nickname);

  await db
    .prepare(
      `INSERT INTO users (id, ${col}, pw_hash, pw_salt, joined_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(id, normalized, pwHash, pwSalt, now)
    .run();

  return { id, nickname: normalized, joinedAt: now };
}

export async function findUserByNickname(nickname: string): Promise<
  | (User & { pwHash: string; pwSalt: string; accountStatus: string })
  | null
> {
  const db = getDb();
  const col = await getUsersLoginColumn(db);
  const normalized = normalizeNickname(nickname);
  if (!normalized) return null;
  return db
    .prepare(
      `SELECT id, ${col} AS nickname, pw_hash AS pwHash, pw_salt AS pwSalt, joined_at AS joinedAt,
              COALESCE(account_status, 'active') AS accountStatus
       FROM users WHERE ${col} = ?`
    )
    .bind(normalized)
    .first<User & { pwHash: string; pwSalt: string; accountStatus: string }>();
}

export async function findUserById(userId: string): Promise<User | null> {
  const db = getDb();
  if (!userId) return null;
  const col = await getUsersLoginColumn(db);
  const row = await db
    .prepare(
      `SELECT id, ${col} AS nickname, joined_at AS joinedAt,
              COALESCE(account_status, 'active') AS accountStatus
       FROM users WHERE id = ?`
    )
    .bind(userId)
    .first<User & { accountStatus: string }>();
  if (!row) return null;
  if (row.accountStatus === "permanent_ban") return null;
  return { id: row.id, nickname: row.nickname, joinedAt: row.joinedAt };
}

export async function removeUserAndData(userId: string): Promise<void> {
  const db = getDb();
  await db.prepare(`DELETE FROM user_client_bindings WHERE user_id = ?`).bind(userId).run();
  await db.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(userId).run();
  await db.prepare(`DELETE FROM reports WHERE reporter_id = ? OR target_id = ?`).bind(userId, userId).run();
  await db
    .prepare(`DELETE FROM transactions WHERE user_a_id = ? OR user_b_id = ?`)
    .bind(userId, userId)
    .run();
  await db.prepare(`DELETE FROM receipts  WHERE taker_id = ?`).bind(userId).run();
  await db
    .prepare(`DELETE FROM receipts WHERE link_id IN (SELECT id FROM links WHERE owner_id = ?)`)
    .bind(userId)
    .run();
  await db.prepare(`DELETE FROM links     WHERE owner_id = ?`).bind(userId).run();
  await db.prepare(`DELETE FROM users     WHERE id = ?`).bind(userId).run();
}

// ── Session ───────────────────────────────────────────────────────────────────

export async function createSession(
  userId: string,
  ttlMs: number = SESSION_TTL_MS
): Promise<{ id: string; validUntil: number }> {
  const db = getDb();
  const now = Date.now();
  const id = crypto.randomUUID();
  const validUntil = now + ttlMs;

  await db
    .prepare(
      `INSERT INTO sessions (id, user_id, valid_until, created_at)
       VALUES (?, ?, ?, ?)`
    )
    .bind(id, userId, validUntil, now)
    .run();

  return { id, validUntil };
}

export async function lookupSession(
  sessionId: string
): Promise<SessionRow | null> {
  const db = getDb();
  const now = Date.now();
  if (!sessionId) return null;

  const row = await db
    .prepare(
      `SELECT id, user_id AS userId, valid_until AS validUntil
       FROM sessions WHERE id = ?`
    )
    .bind(sessionId)
    .first<SessionRow>();

  if (!row) return null;

  if (row.validUntil <= now) {
    await db.prepare(`DELETE FROM sessions WHERE id = ?`).bind(sessionId).run();
    return null;
  }

  return row;
}

export async function destroySession(sessionId: string): Promise<void> {
  const db = getDb();
  if (!sessionId) return;
  await db.prepare(`DELETE FROM sessions WHERE id = ?`).bind(sessionId).run();
}

// ── Settings / Maintenance ────────────────────────────────────────────────────

const MAX_MAINTENANCE_MESSAGE_LEN = 2000;

export async function getSettings(): Promise<{
  maintenanceOn: boolean;
  touchedAt: number;
  maintenanceMessage: string;
  entryGateAblyUrl: string;
}> {
  const db = getDb();
  let maintenanceOn = false;
  let touchedAt = 0;
  let maintenanceMessage = "";

  try {
    const row = await db
      .prepare(
        `SELECT maintenance_on AS maintenanceOn,
                touched_at AS touchedAt,
                IFNULL(maintenance_message, '') AS maintenanceMessage
         FROM settings WHERE key = 'global'`
      )
      .first<{ maintenanceOn: number; touchedAt: number; maintenanceMessage: string }>();

    maintenanceOn = Boolean(row?.maintenanceOn ?? 0);
    touchedAt = row?.touchedAt ?? 0;
    maintenanceMessage = row?.maintenanceMessage ?? "";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const missingCol =
      /no such column/i.test(msg) ||
      /maintenance_message/i.test(msg) ||
      /does not exist/i.test(msg);
    if (!missingCol) throw err;

    const row = await db
      .prepare(
        `SELECT maintenance_on AS maintenanceOn, touched_at AS touchedAt
         FROM settings WHERE key = 'global'`
      )
      .first<{ maintenanceOn: number; touchedAt: number }>();

    maintenanceOn = Boolean(row?.maintenanceOn ?? 0);
    touchedAt = row?.touchedAt ?? 0;
    maintenanceMessage = "";
  }

  let entryGateAblyUrl = DEFAULT_ENTRY_GATE_ABLY_URL;
  try {
    const r = await db
      .prepare(
        `SELECT IFNULL(entry_gate_ably_url, '') AS u FROM settings WHERE key = 'global'`
      )
      .first<{ u: string }>();
    const t = r?.u?.trim();
    if (t) {
      const n = parseAndValidateAblyUrl(t);
      if (n) entryGateAblyUrl = n;
    }
  } catch {
    /* entry_gate_ably_url 컬럼 없음(마이그레이션 전) 등 */
  }

  return { maintenanceOn, touchedAt, maintenanceMessage, entryGateAblyUrl };
}

export async function setEntryGateAblyUrl(
  raw: string
): Promise<{ ok: true; url: string } | { ok: false; reason: "INVALID" }> {
  const normalized = parseAndValidateAblyUrl(raw);
  if (!normalized) return { ok: false, reason: "INVALID" };

  const db = getDb();
  const now = Date.now();
  try {
    await db
      .prepare(
        `UPDATE settings SET entry_gate_ably_url = ?, touched_at = ? WHERE key = 'global'`
      )
      .bind(normalized, now)
      .run();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/no such column/i.test(msg) || /entry_gate_ably_url/i.test(msg)) {
      throw new Error(
        "D1에 migrations/0009_settings_entry_gate_ably_url.sql 을 적용해 주세요. (settings.entry_gate_ably_url)"
      );
    }
    throw err;
  }

  return { ok: true, url: normalized };
}

/** 미들웨어 등: Worker 컨텍스트가 없으면 false (로컬 등). */
export async function getMaintenanceOnSafe(): Promise<boolean> {
  try {
    const ctx = getOptionalRequestContext();
    const db = ctx?.env ? pickD1FromEnv(ctx.env) : undefined;
    if (!db) return false;
    const row = await db
      .prepare(
        `SELECT maintenance_on AS maintenanceOn FROM settings WHERE key = 'global'`
      )
      .first<{ maintenanceOn: number }>();
    return Boolean(row?.maintenanceOn ?? 0);
  } catch {
    return false;
  }
}

export async function setMaintenance(
  on: boolean
): Promise<{ maintenanceOn: boolean; touchedAt: number }> {
  const db = getDb();
  const now = Date.now();

  const prev = await getSettings();

  await db
    .prepare(
      `UPDATE settings SET maintenance_on = ?, touched_at = ? WHERE key = 'global'`
    )
    .bind(on ? 1 : 0, now)
    .run();

  /** 점검(서버 중단과 동일한 UX) 해제 시 대기 명단·매칭 큐 초기화 — 재접속 사용자가 옛 동기화 상태를 갖지 않도록 */
  if (prev.maintenanceOn && !on) {
    await clearTradeWaitlistAndQueue();
  }

  return { maintenanceOn: on, touchedAt: now };
}

export function clampMaintenanceMessage(raw: string): string {
  const t = raw.replace(/\u0000/g, "").trimEnd();
  if (t.length <= MAX_MAINTENANCE_MESSAGE_LEN) return t;
  return t.slice(0, MAX_MAINTENANCE_MESSAGE_LEN);
}

export async function updateMaintenanceMessage(message: string): Promise<void> {
  const db = getDb();
  const now = Date.now();
  const text = clampMaintenanceMessage(message);
  try {
    await db
      .prepare(
        `UPDATE settings SET maintenance_message = ?, touched_at = ? WHERE key = 'global'`
      )
      .bind(text, now)
      .run();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const missingCol =
      /no such column/i.test(msg) ||
      /maintenance_message/i.test(msg) ||
      /does not exist/i.test(msg);
    if (missingCol) {
      throw new Error(
        "D1에 migrations/0003_settings_maintenance_message.sql 을 한 번 실행해 주세요. (settings.maintenance_message 컬럼)"
      );
    }
    throw err;
  }
}

// ── Announcements ─────────────────────────────────────────────────────────────

const MAX_ANNOUNCEMENT_TITLE_LEN = 200;
const MAX_ANNOUNCEMENT_BODY_LEN = 10_000;

export type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  createdAt: number;
};

export function clampAnnouncementTitle(raw: string): string {
  const t = raw.replace(/\u0000/g, "").trim();
  if (t.length <= MAX_ANNOUNCEMENT_TITLE_LEN) return t;
  return t.slice(0, MAX_ANNOUNCEMENT_TITLE_LEN);
}

export function clampAnnouncementBody(raw: string): string {
  const t = raw.replace(/\u0000/g, "").trimEnd();
  if (t.length <= MAX_ANNOUNCEMENT_BODY_LEN) return t;
  return t.slice(0, MAX_ANNOUNCEMENT_BODY_LEN);
}

export async function listAnnouncements(limit = 100): Promise<AnnouncementRow[]> {
  const db = getDb();
  const lim = Math.min(Math.max(1, limit), 200);
  const res = await db
    .prepare(
      `SELECT id, title, body, created_at AS createdAt
       FROM announcements
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(lim)
    .all<AnnouncementRow>();
  return res.results ?? [];
}

export async function createAnnouncement(
  title: string,
  body: string
): Promise<AnnouncementRow> {
  const t = clampAnnouncementTitle(title);
  const b = clampAnnouncementBody(body);
  if (!t.trim()) throw new Error("공지 제목을 입력해주세요.");
  if (!b.trim()) throw new Error("공지 내용을 입력해주세요.");

  const db = getDb();
  const id = crypto.randomUUID();
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO announcements (id, title, body, created_at)
       VALUES (?, ?, ?, ?)`
    )
    .bind(id, t.trim(), b, now)
    .run();

  return { id, title: t.trim(), body: b, createdAt: now };
}

export async function updateAnnouncement(
  id: string,
  title: string,
  body: string
): Promise<{ ok: boolean }> {
  const t = clampAnnouncementTitle(title);
  const b = clampAnnouncementBody(body);
  if (!t.trim()) throw new Error("공지 제목을 입력해주세요.");
  if (!b.trim()) throw new Error("공지 내용을 입력해주세요.");

  const db = getDb();
  const res = await db
    .prepare(`UPDATE announcements SET title = ?, body = ? WHERE id = ?`)
    .bind(t.trim(), b, id)
    .run();
  return { ok: res.meta.changes === 1 };
}

export async function deleteAnnouncement(id: string): Promise<{ ok: boolean }> {
  const db = getDb();
  const res = await db.prepare(`DELETE FROM announcements WHERE id = ?`).bind(id).run();
  return { ok: res.meta.changes === 1 };
}

// ── Link helpers ──────────────────────────────────────────────────────────────

export function parseAblyUrl(raw: string): string | null {
  return parseAndValidateAblyUrl(raw);
}

async function purgeExpiredClaims(db: D1Database, nowMs: number): Promise<void> {
  /* 활성 거래(transactions)가 있는 링크는 만료로 되돌리지 않음 — 신고·15초 UI 동안 유지 */
  await db
    .prepare(
      `UPDATE links
       SET state = 'queued', taker_id = NULL,
           claim_deadline = NULL, claimed_at = NULL, updated_at = ?
       WHERE state = 'claimed'
         AND claim_deadline IS NOT NULL
         AND claim_deadline < ?
         AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.link_id = links.id)`
    )
    .bind(nowMs, nowMs)
    .run();
}

async function recordMatchedPair(db: D1Database, userA: string, userB: string, nowMs: number): Promise<void> {
  const low = userA < userB ? userA : userB;
  const high = userA < userB ? userB : userA;
  await db
    .prepare(
      `INSERT OR REPLACE INTO trade_pair_history (user_low, user_high, matched_at) VALUES (?, ?, ?)`
    )
    .bind(low, high, nowMs)
    .run();
}

export async function isDuplicateLink(
  ownerId: string,
  url: string
): Promise<boolean> {
  const db = getDb();
  const existing = await db
    .prepare(
      `SELECT id FROM links
       WHERE url = ? AND owner_id = ? AND state IN ('queued', 'claimed')`
    )
    .bind(url, ownerId)
    .first<{ id: string }>();
  return existing !== null;
}

export async function enqueueLink(ownerId: string, url: string): Promise<{ id: string }> {
  const db = getDb();
  const now = Date.now();
  const id = crypto.randomUUID();
  await purgeExpiredClaims(db, now);
  await db
    .prepare(
      `INSERT INTO links (id, url, owner_id, state, queue_pos, created_at, updated_at)
       VALUES (?, ?, ?, 'queued', ?, ?, ?)`
    )
    .bind(id, url, ownerId, now, now, now)
    .run();
  return { id };
}

export async function prioritizeLink(
  ownerId: string
): Promise<{ ok: true; id: string } | { ok: false; reason: "NO_QUEUED_LINK" }> {
  const db = getDb();
  const now = Date.now();

  const row = await db
    .prepare(
      `SELECT id FROM links
       WHERE owner_id = ? AND state = 'queued'
       ORDER BY queue_pos DESC
       LIMIT 1`
    )
    .bind(ownerId)
    .first<{ id: string }>();

  if (!row) return { ok: false, reason: "NO_QUEUED_LINK" };

  await db
    .prepare(
      `UPDATE links SET queue_pos = 0, updated_at = ?
       WHERE id = ? AND owner_id = ? AND state = 'queued'`
    )
    .bind(now, row.id, ownerId)
    .run();

  return { ok: true, id: row.id };
}

export async function getLinkCounts(
  userId: string
): Promise<{ total: number; mine: number }> {
  const db = getDb();
  const now = Date.now();
  await purgeExpiredClaims(db, now);

  const total = await db
    .prepare(`SELECT COUNT(*) AS c FROM links WHERE state = 'queued'`)
    .first<{ c: number }>();

  const mine = await db
    .prepare(
      `SELECT COUNT(*) AS c FROM links WHERE state = 'queued' AND owner_id = ?`
    )
    .bind(userId)
    .first<{ c: number }>();

  return { total: total?.c ?? 0, mine: mine?.c ?? 0 };
}

export async function getAdminMetrics(): Promise<AdminMetrics> {
  const db = getDb();
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const startOfDay = now - (now % dayMs);

  const totalUsers = await db
    .prepare(`SELECT COUNT(*) AS c FROM users`)
    .first<{ c: number }>();

  const newUsersToday = await db
    .prepare(`SELECT COUNT(*) AS c FROM users WHERE joined_at >= ?`)
    .bind(startOfDay)
    .first<{ c: number }>();

  const totalLinks = await db
    .prepare(`SELECT COUNT(*) AS c FROM links`)
    .first<{ c: number }>();

  const queuedLinks = await db
    .prepare(`SELECT COUNT(*) AS c FROM links WHERE state = 'queued'`)
    .first<{ c: number }>();

  const consumedLinks = await db
    .prepare(`SELECT COUNT(*) AS c FROM links WHERE state = 'consumed'`)
    .first<{ c: number }>();

  return {
    totalUsers: totalUsers?.c ?? 0,
    newUsersToday: newUsersToday?.c ?? 0,
    totalLinks: totalLinks?.c ?? 0,
    queuedLinks: queuedLinks?.c ?? 0,
    consumedLinks: consumedLinks?.c ?? 0,
  };
}

// ── User profile link / penalty ───────────────────────────────────────────────

export type UserAccountRow = {
  link: string | null;
  lastLinkUpdate: number;
  banUntil: number | null;
  accountStatus: string;
  penaltyCount: number;
  banCount: number;
};

export async function getUserAccount(userId: string): Promise<UserAccountRow | null> {
  const db = getDb();
  const row = await db
    .prepare(
      `SELECT link AS link,
              last_link_update AS lastLinkUpdate,
              ban_until AS banUntil,
              account_status AS accountStatus,
              penalty_count AS penaltyCount,
              ban_count AS banCount
       FROM users WHERE id = ?`
    )
    .bind(userId)
    .first<UserAccountRow>();
  return row ?? null;
}

export async function updateUserProfileLink(userId: string, url: string): Promise<void> {
  const db = getDb();
  const now = Date.now();
  await db
    .prepare(`UPDATE users SET link = ?, last_link_update = ? WHERE id = ?`)
    .bind(url, now, userId)
    .run();
}

export function isUserBanned(account: UserAccountRow, nowMs: number): boolean {
  if (account.accountStatus === "permanent_ban") return true;
  if (account.banUntil != null && account.banUntil > nowMs) return true;
  return false;
}

/** KST 자정 이후 아직 당일 링크 등록(또는 갱신)을 하지 않은 경우 */
export function needsDailyLinkRegistration(lastLinkUpdate: number, nowMs: number): boolean {
  const dayStart = getKstDayStartMs(nowMs);
  return lastLinkUpdate < dayStart;
}

// ── Transactions (거래 창) ────────────────────────────────────────────────────

export type TxRow = {
  id: string;
  linkId: string;
  userAId: string;
  userBId: string;
  urlA: string;
  urlB: string;
  status: string;
  aJoinedAt: number | null;
  bJoinedAt: number | null;
  aClickedAt: number | null;
  bClickedAt: number | null;
  createdAt: number;
};

export async function getTransactionById(id: string): Promise<TxRow | null> {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, link_id AS linkId, user_a_id AS userAId, user_b_id AS userBId,
              url_a AS urlA, url_b AS urlB, status,
              a_joined_at AS aJoinedAt, b_joined_at AS bJoinedAt,
              a_clicked_at AS aClickedAt, b_clicked_at AS bClickedAt,
              created_at AS createdAt
       FROM transactions WHERE id = ?`
    )
    .bind(id)
    .first<TxRow>();
}

export async function markTransactionPresence(txId: string, userId: string): Promise<void> {
  const db = getDb();
  const now = Date.now();
  const row = await getTransactionById(txId);
  if (!row) return;
  if (row.userAId === userId) {
    await db
      .prepare(`UPDATE transactions SET a_joined_at = COALESCE(a_joined_at, ?) WHERE id = ?`)
      .bind(now, txId)
      .run();
  } else if (row.userBId === userId) {
    await db
      .prepare(`UPDATE transactions SET b_joined_at = COALESCE(b_joined_at, ?) WHERE id = ?`)
      .bind(now, txId)
      .run();
  }
}

export async function recordPeerLinkClick(
  txId: string,
  userId: string
): Promise<
  | { ok: true; status: string }
  | { ok: false; reason: "NOT_FOUND" | "FORBIDDEN" | "ALREADY_DONE" | "EXPIRED" }
> {
  const db = getDb();
  const now = Date.now();
  const row = await getTransactionById(txId);
  if (!row) return { ok: false, reason: "NOT_FOUND" };
  if (row.userAId !== userId && row.userBId !== userId) {
    return { ok: false, reason: "FORBIDDEN" };
  }

  const linkCheck = await db
    .prepare(`SELECT state, claim_deadline FROM links WHERE id = ?`)
    .bind(row.linkId)
    .first<{ state: string; claimDeadline: number | null }>();
  if (!linkCheck || linkCheck.state !== "claimed") {
    return { ok: false, reason: "NOT_FOUND" };
  }

  /** 거래 창이 열려 있는 동안은 링크 큐용 15초 claim_deadline 으로 클릭을 막지 않음 */
  const activeTxOnLink = await db
    .prepare(
      `SELECT 1 AS x FROM transactions WHERE link_id = ? AND COALESCE(status, '') != 'completed' LIMIT 1`
    )
    .bind(row.linkId)
    .first<{ x: number }>();

  if (
    !activeTxOnLink &&
    linkCheck.claimDeadline != null &&
    linkCheck.claimDeadline < now
  ) {
    return { ok: false, reason: "EXPIRED" };
  }

  if (userId === row.userAId) {
    if (row.aClickedAt != null) {
      return { ok: true, status: row.status };
    }
    await db.prepare(`UPDATE transactions SET a_clicked_at = ? WHERE id = ?`).bind(now, txId).run();
  } else {
    if (row.bClickedAt != null) {
      return { ok: true, status: row.status };
    }
    await db.prepare(`UPDATE transactions SET b_clicked_at = ? WHERE id = ?`).bind(now, txId).run();
  }

  const fresh = await getTransactionById(txId);
  if (!fresh) return { ok: false, reason: "NOT_FOUND" };

  let statusOut: string;
  if (fresh.aClickedAt && fresh.bClickedAt) {
    statusOut = "completed";
    await db.prepare(`UPDATE transactions SET status = 'completed' WHERE id = ?`).bind(txId).run();
    await db
      .prepare(
        `UPDATE links SET state = 'consumed', consumed_at = ?, updated_at = ?
         WHERE id = ? AND state = 'claimed'`
      )
      .bind(now, now, row.linkId)
      .run();
  } else if (fresh.aClickedAt) {
    statusOut = "a_clicked";
    await db.prepare(`UPDATE transactions SET status = 'a_clicked' WHERE id = ?`).bind(txId).run();
  } else {
    statusOut = "b_clicked";
    await db.prepare(`UPDATE transactions SET status = 'b_clicked' WHERE id = ?`).bind(txId).run();
  }

  return { ok: true, status: statusOut };
}

export type TransactionClientView = {
  role: "a" | "b";
  peerUserId: string;
  peerLink: string;
  myLink: string;
  status: string;
  peerPresent: boolean;
  iPresent: boolean;
  peerClickedMyLink: boolean;
  iClickedPeerLink: boolean;
  phase: "waiting" | "peer_connected" | "done";
  createdAt: number;
  claimDeadline: number | null;
  showReport: boolean;
};

/** 영구 정지 시 해당 계정에 바인딩된 브라우저 클라이언트 ID를 재가입 차단 목록에 넣음 */
async function blockClientIdsLinkedToUser(
  db: D1Database,
  userId: string,
  nowMs: number
): Promise<void> {
  const rows = await db
    .prepare(`SELECT client_id AS cid FROM user_client_bindings WHERE user_id = ?`)
    .bind(userId)
    .all<{ cid: string }>();
  for (const r of rows.results ?? []) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO blocked_client_ids (client_id, created_at, source_user_id)
         VALUES (?, ?, ?)`
      )
      .bind(r.cid, nowMs, userId)
      .run();
  }
}

const UUID_RE =
  /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

export async function isClientIdBlocked(clientId: string): Promise<boolean> {
  const trimmed = clientId.trim().toLowerCase();
  if (!UUID_RE.test(trimmed)) return false;
  const db = getDb();
  const row = await db
    .prepare(`SELECT 1 AS x FROM blocked_client_ids WHERE client_id = ?`)
    .bind(trimmed)
    .first<{ x: number }>();
  return row != null;
}

export async function bindUserClientId(userId: string, clientId: string): Promise<void> {
  const trimmed = clientId.trim().toLowerCase();
  if (!UUID_RE.test(trimmed)) return;
  const db = getDb();
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO user_client_bindings (user_id, client_id, bound_at)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id, client_id) DO UPDATE SET bound_at = excluded.bound_at`
    )
    .bind(userId, trimmed, now)
    .run();
}

export type TradeRestriction =
  | { ok: true }
  | { ok: false; kind: "permanent" }
  | { ok: false; kind: "temp"; until: number };

export async function getTradeRestriction(
  userId: string,
  nowMs: number
): Promise<TradeRestriction> {
  const db = getDb();
  const row = await db
    .prepare(
      `SELECT COALESCE(account_status, 'active') AS accountStatus, ban_until AS banUntil
       FROM users WHERE id = ?`
    )
    .bind(userId)
    .first<{ accountStatus: string; banUntil: number | null }>();
  if (!row) return { ok: false, kind: "permanent" };
  if (row.accountStatus === "permanent_ban") return { ok: false, kind: "permanent" };
  if (row.banUntil != null && row.banUntil > nowMs) {
    return { ok: false, kind: "temp", until: row.banUntil };
  }
  return { ok: true };
}

export async function buildTransactionClientView(
  txId: string,
  userId: string,
  nowMs: number
): Promise<TransactionClientView | null> {
  const db = getDb();
  const row = await getTransactionById(txId);
  if (!row) return null;

  const linkRow = await db
    .prepare(`SELECT claim_deadline AS claimDeadline FROM links WHERE id = ?`)
    .bind(row.linkId)
    .first<{ claimDeadline: number | null }>();

  if (row.userAId !== userId && row.userBId !== userId) return null;
  const role: "a" | "b" = row.userAId === userId ? "a" : "b";

  const peerLink = role === "a" ? row.urlB : row.urlA;
  const myLink = role === "a" ? row.urlA : row.urlB;
  const peerUserId = role === "a" ? row.userBId : row.userAId;

  const iPresent = role === "a" ? row.aJoinedAt != null : row.bJoinedAt != null;
  const peerPresent = role === "a" ? row.bJoinedAt != null : row.aJoinedAt != null;

  const iClickedPeerLink = role === "a" ? row.aClickedAt != null : row.bClickedAt != null;
  const peerClickedMyLink = role === "a" ? row.bClickedAt != null : row.aClickedAt != null;

  const done = Boolean(row.aClickedAt && row.bClickedAt) || row.status === "completed";
  let phase: TransactionClientView["phase"] = "waiting";
  if (done) phase = "done";
  else if (peerPresent) phase = "peer_connected";

  const elapsed = nowMs - row.createdAt;
  const showReport = elapsed >= 15_000 && !peerClickedMyLink && !done;

  return {
    role,
    peerUserId,
    peerLink,
    myLink,
    status: row.status,
    peerPresent,
    iPresent,
    peerClickedMyLink,
    iClickedPeerLink,
    phase,
    createdAt: row.createdAt,
    claimDeadline: linkRow?.claimDeadline ?? null,
    showReport,
  };
}

/** 나를 대상(target)으로 한 신고 건수 */
export async function countReportsAgainstUser(targetUserId: string): Promise<number> {
  const db = getDb();
  const row = await db
    .prepare(`SELECT COUNT(*) AS c FROM reports WHERE target_id = ?`)
    .bind(targetUserId)
    .first<{ c: number }>();
  return row?.c ?? 0;
}

/**
 * 신고 3회 이상 누적·영구 정지: 자발적 로그아웃·탈퇴를 막을 때 사용.
 * (쿠키/로컬스토리지 삭제는 막을 수 없음)
 */
export async function isAccountControlsLocked(userId: string): Promise<boolean> {
  const db = getDb();
  const row = await db
    .prepare(`SELECT COALESCE(account_status, 'active') AS st FROM users WHERE id = ?`)
    .bind(userId)
    .first<{ st: string }>();
  if (!row) return true;
  if (row.st === "permanent_ban") return true;
  const n = await countReportsAgainstUser(userId);
  return n >= 3;
}

/**
 * 이 브라우저 클라이언트 ID에 묶인 계정 중 신고 3회 이상(또는 영구 정지)인 계정이 있으면
 * 같은 기기에서 추가 회원가입을 막음.
 */
export async function isNewRegistrationBlockedForClient(clientId: string): Promise<boolean> {
  const trimmed = clientId.trim().toLowerCase();
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(trimmed)) {
    return false;
  }
  const db = getDb();
  const row = await db
    .prepare(
      `SELECT 1 AS x
       FROM user_client_bindings b
       JOIN users u ON u.id = b.user_id
       WHERE b.client_id = ?
         AND (
           COALESCE(u.account_status, 'active') = 'permanent_ban'
           OR (SELECT COUNT(*) FROM reports r WHERE r.target_id = u.id) >= 3
         )
       LIMIT 1`
    )
    .bind(trimmed)
    .first<{ x: number }>();
  return row != null;
}

export async function createReport(
  reporterId: string,
  targetId: string,
  reason: string
): Promise<{ ok: true } | { ok: false; reason: "SELF" | "TEXT" }> {
  if (reporterId === targetId) return { ok: false, reason: "SELF" };
  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, reason: "TEXT" };

  const db = getDb();
  const now = Date.now();
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO reports (id, reporter_id, target_id, reason, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(id, reporterId, targetId, trimmed, now)
    .run();

  const total = await countReportsAgainstUser(targetId);

  if (total > 0 && total % 3 === 0) {
    const u = await db
      .prepare(`SELECT ban_count AS banCount FROM users WHERE id = ?`)
      .bind(targetId)
      .first<{ banCount: number }>();
    const nextBan = (u?.banCount ?? 0) + 1;
    if (nextBan >= 3) {
      await db
        .prepare(
          `UPDATE users
           SET account_status = 'permanent_ban',
               ban_count = ?,
               penalty_count = penalty_count + 1,
               ban_until = NULL
           WHERE id = ?`
        )
        .bind(nextBan, targetId)
        .run();
      await blockClientIdsLinkedToUser(db, targetId, now);
    } else {
      const until = now + 12 * 60 * 60 * 1000;
      await db
        .prepare(
          `UPDATE users
           SET ban_until = ?,
               ban_count = ?,
               penalty_count = penalty_count + 1
           WHERE id = ?`
        )
        .bind(until, nextBan, targetId)
        .run();
    }
  }

  return { ok: true };
}

// ── Link claim / consume / return ─────────────────────────────────────────────

export async function acquireLink(takerId: string): Promise<
  | { ok: true; link: { id: string; url: string; deadline: number }; transactionId: string }
  | { ok: false; reason: "NO_LINK" | "RACE" | "NO_USER_LINK" | "NO_TX_TABLE" }
> {
  const db = getDb();
  const now = Date.now();
  const deadline = now + CLAIM_WINDOW_MS;

  await purgeExpiredClaims(db, now);

  const takerAccount = await db
    .prepare(`SELECT link FROM users WHERE id = ?`)
    .bind(takerId)
    .first<{ link: string | null }>();
  const takerLink = takerAccount?.link?.trim();
  if (!takerLink) {
    return { ok: false, reason: "NO_USER_LINK" };
  }

  const candidate = await db
    .prepare(
      `SELECT l.id, l.url, l.owner_id AS ownerId
       FROM links l
       WHERE l.state = 'queued'
         AND l.owner_id != ?
         AND NOT EXISTS (
           SELECT 1 FROM receipts r
           WHERE r.link_id = l.id AND r.taker_id = ?
         )
       ORDER BY l.queue_pos ASC
       LIMIT 1`
    )
    .bind(takerId, takerId)
    .first<{ id: string; url: string; ownerId: string }>();

  if (!candidate) {
    return { ok: false, reason: "NO_LINK" };
  }

  const result = await db
    .prepare(
      `UPDATE links
       SET state = 'claimed', taker_id = ?, claim_deadline = ?, claimed_at = ?, updated_at = ?
       WHERE id = ? AND state = 'queued'`
    )
    .bind(takerId, deadline, now, now, candidate.id)
    .run();

  if (result.meta.changes !== 1) {
    return { ok: false, reason: "RACE" };
  }

  await db
    .prepare(`INSERT OR IGNORE INTO receipts (link_id, taker_id, created_at) VALUES (?, ?, ?)`)
    .bind(candidate.id, takerId, now)
    .run();

  const txId = crypto.randomUUID();
  try {
    await db
      .prepare(
        `INSERT INTO transactions (id, link_id, user_a_id, user_b_id, url_a, url_b, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
      )
      .bind(txId, candidate.id, candidate.ownerId, takerId, candidate.url, takerLink, now)
      .run();
    await recordMatchedPair(db, candidate.ownerId, takerId, now);
  } catch {
    await db
      .prepare(
        `UPDATE links
         SET state = 'queued', taker_id = NULL, claim_deadline = NULL, claimed_at = NULL, updated_at = ?
         WHERE id = ? AND state = 'claimed' AND taker_id = ?`
      )
      .bind(now, candidate.id, takerId)
      .run();
    await db.prepare(`DELETE FROM receipts WHERE link_id = ? AND taker_id = ?`).bind(candidate.id, takerId).run();
    return { ok: false, reason: "NO_TX_TABLE" };
  }

  return {
    ok: true,
    link: { id: candidate.id, url: candidate.url, deadline },
    transactionId: txId,
  };
}

export async function confirmLink(
  takerId: string,
  linkId: string
): Promise<{ ok: true; url: string } | { ok: false; reason: "NOT_CLAIMED" | "EXPIRED" }> {
  const db = getDb();
  const now = Date.now();
  await purgeExpiredClaims(db, now);

  const row = await db
    .prepare(
      `SELECT id, url, taker_id AS takerId, claim_deadline AS claimDeadline, state
       FROM links WHERE id = ?`
    )
    .bind(linkId)
    .first<{
      id: string;
      url: string;
      takerId: string | null;
      claimDeadline: number | null;
      state: string;
    }>();

  if (!row || row.state !== "claimed" || row.takerId !== takerId) {
    return { ok: false, reason: "NOT_CLAIMED" };
  }
  if (!row.claimDeadline || row.claimDeadline < now) {
    return { ok: false, reason: "EXPIRED" };
  }

  await db
    .prepare(
      `UPDATE links SET state = 'consumed', consumed_at = ?, updated_at = ?
       WHERE id = ? AND state = 'claimed' AND taker_id = ?`
    )
    .bind(now, now, linkId, takerId)
    .run();

  return { ok: true, url: row.url };
}

export async function releaseLink(
  takerId: string,
  linkId: string
): Promise<{ ok: boolean }> {
  const db = getDb();
  const now = Date.now();

  await db.prepare(`DELETE FROM transactions WHERE link_id = ?`).bind(linkId).run();

  const res = await db
    .prepare(
      `UPDATE links
       SET state = 'queued', taker_id = NULL, claim_deadline = NULL, claimed_at = NULL, updated_at = ?
       WHERE id = ? AND state = 'claimed' AND taker_id = ?`
    )
    .bind(now, linkId, takerId)
    .run();

  return { ok: res.meta.changes === 1 };
}

// ── Trade waitlist / peer matching (no link-queue upload) ─────────────────────

/** 대기 명단·매칭 대기열 전체 삭제 (점검 해제 시 등) */
export async function clearTradeWaitlistAndQueue(): Promise<void> {
  const db = getDb();
  await db.prepare(`DELETE FROM trade_match_queue`).run();
  await db.prepare(`DELETE FROM trade_waitlist`).run();
}

export async function getTradeWaitlistStats(userId: string): Promise<{
  count: number;
  enrolled: boolean;
}> {
  const db = getDb();
  const cnt = await db
    .prepare(`SELECT COUNT(*) AS c FROM trade_waitlist`)
    .first<{ c: number }>();
  const row = await db
    .prepare(`SELECT 1 AS x FROM trade_waitlist WHERE user_id = ?`)
    .bind(userId)
    .first<{ x: number }>();
  return { count: cnt?.c ?? 0, enrolled: row != null };
}

export async function setTradeWaitlistEnrollment(
  userId: string,
  enrolled: boolean
): Promise<void> {
  const db = getDb();
  if (enrolled) {
    const now = Date.now();
    await db
      .prepare(`INSERT OR REPLACE INTO trade_waitlist (user_id, joined_at) VALUES (?, ?)`)
      .bind(userId, now)
      .run();
  } else {
    await db.prepare(`DELETE FROM trade_waitlist WHERE user_id = ?`).bind(userId).run();
    await db.prepare(`DELETE FROM trade_match_queue WHERE user_id = ?`).bind(userId).run();
  }
}

export type SeekTradeResult =
  | { ok: true; link: { id: string; url: string; deadline: number }; transactionId: string }
  | { ok: true; waiting: true }
  | {
      ok: false;
      reason:
        | "NOT_ON_WAITLIST"
        | "NO_USER_LINK"
        | "NO_TX_TABLE"
        | "TRADE_TEMP_BAN"
        | "PERMANENT_TRADE_BAN";
    };

export async function seekTradePartner(userId: string): Promise<SeekTradeResult> {
  const db = getDb();
  const now = Date.now();
  const deadline = now + CLAIM_WINDOW_MS;
  await purgeExpiredClaims(db, now);

  const tradeRule = await getTradeRestriction(userId, now);
  if (!tradeRule.ok) {
    return {
      ok: false,
      reason: tradeRule.kind === "permanent" ? "PERMANENT_TRADE_BAN" : "TRADE_TEMP_BAN",
    };
  }

  const onList = await db
    .prepare(`SELECT 1 AS x FROM trade_waitlist WHERE user_id = ?`)
    .bind(userId)
    .first<{ x: number }>();
  if (!onList) return { ok: false, reason: "NOT_ON_WAITLIST" };

  const takerAccount = await db
    .prepare(`SELECT link FROM users WHERE id = ?`)
    .bind(userId)
    .first<{ link: string | null }>();
  const myLink = takerAccount?.link?.trim();
  if (!myLink) return { ok: false, reason: "NO_USER_LINK" };

  const existing = await db
    .prepare(
      `SELECT t.id AS txId, t.link_id AS linkId, l.url AS url, l.claim_deadline AS cd
       FROM transactions t
       JOIN links l ON l.id = t.link_id
       WHERE (t.user_a_id = ? OR t.user_b_id = ?)
         AND l.state = 'claimed'
         AND COALESCE(t.status, '') != 'completed'
       LIMIT 1`
    )
    .bind(userId, userId)
    .first<{ txId: string; linkId: string; url: string; cd: number | null }>();

  if (existing) {
    return {
      ok: true,
      link: {
        id: existing.linkId,
        url: existing.url,
        deadline: existing.cd ?? deadline,
      },
      transactionId: existing.txId,
    };
  }

  const peerRow = await db
    .prepare(
      `SELECT m.user_id AS peerId
       FROM trade_match_queue m
       JOIN users u ON u.id = m.user_id
       LEFT JOIN trade_pair_history h
         ON h.user_low = (CASE WHEN ? < m.user_id THEN ? ELSE m.user_id END)
        AND h.user_high = (CASE WHEN ? < m.user_id THEN m.user_id ELSE ? END)
       WHERE m.user_id != ?
         AND h.user_low IS NULL
         AND COALESCE(u.account_status, 'active') != 'permanent_ban'
         AND (u.ban_until IS NULL OR u.ban_until <= ?)
       ORDER BY m.requested_at ASC
       LIMIT 1`
    )
    .bind(userId, userId, userId, userId, userId, now)
    .first<{ peerId: string }>();

  if (peerRow) {
    const peerId = peerRow.peerId;
    const peerAccount = await db
      .prepare(`SELECT link FROM users WHERE id = ?`)
      .bind(peerId)
      .first<{ link: string | null }>();
    const peerLink = peerAccount?.link?.trim();

    await db
      .prepare(`DELETE FROM trade_match_queue WHERE user_id IN (?, ?)`)
      .bind(peerId, userId)
      .run();

    if (!peerLink) {
      await db.prepare(`INSERT OR REPLACE INTO trade_match_queue (user_id, requested_at) VALUES (?, ?)`).bind(userId, now).run();
      return { ok: true, waiting: true };
    }

    const linkId = crypto.randomUUID();
    const txId = crypto.randomUUID();

    try {
      await db
        .prepare(
          `INSERT INTO links (
             id, url, owner_id, state, queue_pos, created_at, updated_at,
             taker_id, claim_deadline, claimed_at
           ) VALUES (?, ?, ?, 'queued', ?, ?, ?, NULL, NULL, NULL)`
        )
        .bind(linkId, peerLink, peerId, now, now, now)
        .run();

      await db
        .prepare(
          `UPDATE links SET state = 'claimed', taker_id = ?, claim_deadline = ?, claimed_at = ?, updated_at = ?
           WHERE id = ? AND state = 'queued'`
        )
        .bind(userId, deadline, now, now, linkId)
        .run();

      await db
        .prepare(`INSERT OR IGNORE INTO receipts (link_id, taker_id, created_at) VALUES (?, ?, ?)`)
        .bind(linkId, userId, now)
        .run();

      await db
        .prepare(
          `INSERT INTO transactions (id, link_id, user_a_id, user_b_id, url_a, url_b, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
        )
        .bind(txId, linkId, peerId, userId, peerLink, myLink, now)
        .run();
      await recordMatchedPair(db, peerId, userId, now);
    } catch {
      try {
        await db.prepare(`DELETE FROM receipts WHERE link_id = ?`).bind(linkId).run();
        await db.prepare(`DELETE FROM links WHERE id = ?`).bind(linkId).run();
      } catch {
        /* ignore cleanup errors */
      }
      return { ok: false, reason: "NO_TX_TABLE" };
    }

    return {
      ok: true,
      link: { id: linkId, url: peerLink, deadline },
      transactionId: txId,
    };
  }

  await db
    .prepare(`INSERT OR REPLACE INTO trade_match_queue (user_id, requested_at) VALUES (?, ?)`)
    .bind(userId, now)
    .run();
  return { ok: true, waiting: true };
}
