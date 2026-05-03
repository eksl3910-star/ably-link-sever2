import { PBKDF2_ITERATIONS } from "@/lib/constants";

// ── Hex helpers ──────────────────────────────────────────────────────────────

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

// ── PBKDF2 derivation ────────────────────────────────────────────────────────

export async function deriveKey(
  password: string,
  existingSaltHex?: string
): Promise<{ hash: string; salt: string }> {
  const enc = new TextEncoder();
  const saltBytes: Uint8Array<ArrayBuffer> = existingSaltHex
    ? (hexToBytes(existingSaltHex) as Uint8Array<ArrayBuffer>)
    : (crypto.getRandomValues(new Uint8Array(16)) as Uint8Array<ArrayBuffer>);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: saltBytes,
      iterations: PBKDF2_ITERATIONS,
    },
    keyMaterial,
    256
  );

  return {
    hash: bytesToHex(new Uint8Array(bits)),
    salt: bytesToHex(saltBytes),
  };
}

export async function verifyKey(
  password: string,
  storedHash: string,
  storedSalt: string
): Promise<boolean> {
  const { hash } = await deriveKey(password, storedSalt);
  return timingSafeCompare(hash, storedHash);
}

// ── Timing-safe string comparison (Edge Runtime compatible) ──────────────────

export function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
