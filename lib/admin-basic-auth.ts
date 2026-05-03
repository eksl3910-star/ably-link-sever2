/** 브라우저 Basic Auth(관리자 HTML 경로 전용). /api/admin 은 적용하지 않습니다(fetch 가 헤더를 안 붙이는 문제 방지). */

function timingSafeEqualUtf8(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i]! ^ bb[i]!;
  return diff === 0;
}

export function verifyAdminBasicAuthHeader(
  authorizationHeader: string | null,
  expectedUser: string,
  expectedPass: string
): boolean {
  const eu = expectedUser.trim();
  const ep = expectedPass.trim();
  if (!authorizationHeader?.startsWith("Basic ")) return false;
  let decoded: string;
  try {
    const b64 = authorizationHeader.slice(6).trim();
    decoded = atob(b64);
  } catch {
    return false;
  }
  const idx = decoded.indexOf(":");
  const user = (idx === -1 ? decoded : decoded.slice(0, idx)).trim();
  const pass = (idx === -1 ? "" : decoded.slice(idx + 1)).trim();
  return timingSafeEqualUtf8(user, eu) && timingSafeEqualUtf8(pass, ep);
}
