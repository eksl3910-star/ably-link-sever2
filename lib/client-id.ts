/** 브라우저에 저장되는 익명 클라이언트 ID (재가입 차단용, 서버와만 함께 사용) */
export const CLIENT_ID_STORAGE_KEY = "ably_client_id";

export function getOrCreateClientId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
    if (!id || id.length < 30) {
      id = crypto.randomUUID();
      localStorage.setItem(CLIENT_ID_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}
