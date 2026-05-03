import { ABLY_HOSTNAME } from "@/lib/constants";

/** 본문에 에이블리 호스트(a-bly.com)가 포함되는지 Regex로 검사 */
const ABLY_HOST_PATTERN = /a-bly\.com/i;

export function containsAblyHostname(raw: string): boolean {
  return ABLY_HOST_PATTERN.test(raw.trim());
}

/** 첫 URL을 파싱해 a-bly.com 인지 검증하고 정규화된 https URL 반환 */
export function parseAndValidateAblyUrl(raw: string): string | null {
  const text = raw.trim();
  const match = text.match(/https?:\/\/[^\s]+/i);
  if (!match) return null;
  try {
    const url = new URL(match[0]);
    if (!containsAblyHostname(url.hostname) && !containsAblyHostname(url.href)) {
      return null;
    }
    if (!url.hostname.toLowerCase().endsWith(ABLY_HOSTNAME)) return null;
    return url.toString();
  } catch {
    return null;
  }
}
