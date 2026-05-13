import { ABLY_APP_LINK_HOSTNAME } from "@/lib/constants";

/** 첫 URL을 파싱해 https://applink.a-bly.com/ 형태만 허용하고 정규화된 URL 반환 */
export function parseAndValidateAblyUrl(raw: string): string | null {
  const text = raw.trim();
  const match = text.match(/https?:\/\/[^\s]+/i);
  if (!match) return null;
  try {
    const url = new URL(match[0]);
    if (url.protocol !== "https:") return null;
    if (url.hostname.toLowerCase() !== ABLY_APP_LINK_HOSTNAME) return null;
    return url.toString();
  } catch {
    return null;
  }
}
