/**
 * KST 기준 현재 시각이 속한 시간 구간 ID (매 정각마다 변경).
 * 로그인 후 메인 진입 버튼을 시간대마다 다시 누르게 할 때 사용.
 */
export function getKstHourBucketId(nowMs: number = Date.now()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date(nowMs));
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}-${get("hour")}`;
}

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
