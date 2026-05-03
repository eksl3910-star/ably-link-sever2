/**
 * Cloudflare Worker — Scheduled (Cron)  
 * UTC 15:00 매일 = 한국시간(KST) 자정 직후: links, transactions 및 당일 사용자 링크 필드 초기화
 *
 * reports(신고)는 페널티 누적용으로 삭제하지 않습니다.
 */

export interface Env {
  DB: D1Database;
}

async function runDailyReset(db: D1Database): Promise<void> {
  await db.batch([
    db.prepare(`DELETE FROM transactions`),
    db.prepare(`DELETE FROM receipts`),
    db.prepare(`DELETE FROM links`),
    db.prepare(`UPDATE users SET link = NULL, last_link_update = 0`),
  ]);
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      runDailyReset(env.DB).catch((err) => {
        console.error("[daily-reset]", err);
      })
    );
  },
};
