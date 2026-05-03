import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_TTL_MS, SESSION_TTL_SHORT_MS } from "@/lib/constants";
import { createSession, destroySession, lookupSession, findUserById } from "@/lib/database";
import type { User } from "@/lib/database";

// Issue a new session cookie for the given user ID
export async function issueSession(
  userId: string,
  options?: { rememberMe?: boolean }
): Promise<void> {
  const rememberMe = options?.rememberMe !== false;
  const ttl = rememberMe ? SESSION_TTL_MS : SESSION_TTL_SHORT_MS;
  const session = await createSession(userId, ttl);
  const store = await cookies();
  const base = {
    path: "/" as const,
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
  };
  if (rememberMe) {
    store.set(SESSION_COOKIE, session.id, {
      ...base,
      maxAge: Math.floor(ttl / 1000),
      expires: new Date(session.validUntil),
    });
  } else {
    store.set(SESSION_COOKIE, session.id, base);
  }
}

// Revoke the current session and clear the cookie
export async function revokeSession(): Promise<void> {
  const store = await cookies();
  const sessionId = store.get(SESSION_COOKIE)?.value ?? "";
  if (sessionId) {
    await destroySession(sessionId);
  }
  store.set(SESSION_COOKIE, "", { path: "/", expires: new Date(0) });
}

// Resolve the currently authenticated user from the session cookie
export async function resolveUser(): Promise<User | null> {
  const store = await cookies();
  const sessionId = store.get(SESSION_COOKIE)?.value ?? "";
  if (!sessionId) return null;

  const session = await lookupSession(sessionId);
  if (!session) return null;

  return findUserById(session.userId);
}
