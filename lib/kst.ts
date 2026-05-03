/** 한국 표준시(KST, Asia/Seoul) 기준 자정의 UTC epoch(ms). */
export function getKstDayStartMs(nowMs: number = Date.now()): number {
  const kstYmd = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(nowMs));
  return new Date(`${kstYmd}T00:00:00+09:00`).getTime();
}
