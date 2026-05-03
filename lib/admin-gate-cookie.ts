const GATE_TTL_MS = 12 * 60 * 60 * 1000;

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const buf = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createAdminGateCookie(secret: string): Promise<string> {
  const exp = Date.now() + GATE_TTL_MS;
  const sig = await hmacSha256Hex(secret, String(exp));
  return `${exp}.${sig}`;
}

export async function verifyAdminGateCookie(
  cookie: string | undefined,
  secret: string
): Promise<boolean> {
  if (!cookie || !secret) return false;
  const dot = cookie.indexOf(".");
  if (dot < 1) return false;
  const expStr = cookie.slice(0, dot);
  const sig = cookie.slice(dot + 1);
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  const expected = await hmacSha256Hex(secret, String(exp));
  return timingSafeEqualHex(sig, expected);
}
