import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getOptionalRequestContext } from "@cloudflare/next-on-pages";
import { ADMIN_GATE_COOKIE, SESSION_COOKIE } from "@/lib/constants";
import { verifyAdminBasicAuthHeader } from "@/lib/admin-basic-auth";
import { createAdminGateCookie, verifyAdminGateCookie } from "@/lib/admin-gate-cookie";
import { getMaintenanceOnSafe } from "@/lib/database";

// ── Path classifiers ──────────────────────────────────────────────────────────

/** 점검 중에도 접근 허용 (관리·설정 조회). */
function isMaintenanceExempt(pathname: string): boolean {
  if (pathname === "/maintenance" || pathname.startsWith("/maintenance/")) return true;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return true;
  if (pathname.startsWith("/api/admin")) return true;
  if (pathname === "/api/settings" || pathname.startsWith("/api/settings/")) return true;
  return false;
}

/** 관리자 화면(HTML)만 — /api/admin 은 제외(페이지 내 fetch 가 Authorization 을 유지하지 않음). */
function isAdminPagePath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isProtectedUserRoute(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/api/links/") ||
    pathname.startsWith("/api/announcements") ||
    pathname.startsWith("/api/auth/logout") ||
    pathname.startsWith("/api/auth/delete") ||
    pathname.startsWith("/api/auth/me")
  );
}

function getAdminBasicCredentials(): { user: string; pass: string; passAlt: string } {
  const ctx = getOptionalRequestContext();
  const env = ctx?.env as Record<string, unknown> | undefined;
  const envUser = typeof env?.ADMIN_BASIC_USER === "string" ? env.ADMIN_BASIC_USER : "";
  const envPass = typeof env?.ADMIN_BASIC_PASS === "string" ? env.ADMIN_BASIC_PASS : "";
  const envToggle = typeof env?.ADMIN_TOGGLE_PASS === "string" ? env.ADMIN_TOGGLE_PASS : "";
  const user = (envUser || process.env.ADMIN_BASIC_USER || "admin").trim();
  const pass = (envPass || process.env.ADMIN_BASIC_PASS || "").trim();
  const passAlt = (envToggle || process.env.ADMIN_TOGGLE_PASS || "").trim();
  return { user, pass, passAlt };
}

function getAdminGateSecret(env: Record<string, unknown> | undefined, basicUser: string, basicPass: string): string {
  const from = (k: string) =>
    (typeof env?.[k] === "string" ? (env[k] as string) : "") || process.env[k] || "";
  return (
    from("ADMIN_GATE_SECRET").trim() ||
    from("ADMIN_TOGGLE_PASS").trim() ||
    from("ADMIN_BASIC_PASS").trim() ||
    `${basicUser.trim()}:${basicPass.trim()}`
  );
}

function verifyAdminBasicAny(
  authorization: string | null,
  user: string,
  pass: string,
  passAlt: string
): boolean {
  if (pass && verifyAdminBasicAuthHeader(authorization, user, pass)) return true;
  if (passAlt && verifyAdminBasicAuthHeader(authorization, user, passAlt)) return true;
  return false;
}

// ── Middleware ────────────────────────────────────────────────────────────────

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;
  const maintenanceOn = await getMaintenanceOnSafe();

  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);

  if (
    (pathname === "/welcome" || pathname.startsWith("/welcome/")) &&
    hasSession
  ) {
    const homeUrl = req.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  if (maintenanceOn) {
    if (!isMaintenanceExempt(pathname)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "현재 점검 중입니다. 잠시 후 다시 시도해주세요." },
          { status: 503 }
        );
      }
      const maintenanceUrl = req.nextUrl.clone();
      maintenanceUrl.pathname = "/maintenance";
      maintenanceUrl.search = "";
      return NextResponse.redirect(maintenanceUrl);
    }
  } else {
    if (pathname === "/maintenance" || pathname.startsWith("/maintenance/")) {
      const homeUrl = req.nextUrl.clone();
      homeUrl.pathname = "/";
      homeUrl.search = "";
      return NextResponse.redirect(homeUrl);
    }
  }

  if (isAdminPagePath(pathname)) {
    const { user: basicUser, pass: basicPass, passAlt } = getAdminBasicCredentials();
    const dev = process.env.NODE_ENV === "development";
    if (!basicPass && !passAlt) {
      if (!dev) {
        return new NextResponse(
          "ADMIN_BASIC_PASS 또는 ADMIN_TOGGLE_PASS 가 설정되지 않았습니다. Cloudflare 환경 변수를 확인하세요.",
          { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }
        );
      }
      /* 로컬(next dev)에서 env 미설정 시 Basic 생략 — 프로덕션에서는 반드시 설정 */
    } else {
      const ctxEnv = getOptionalRequestContext()?.env as Record<string, unknown> | undefined;
      const gateSecret = getAdminGateSecret(ctxEnv, basicUser, basicPass || passAlt);
      const gate = req.cookies.get(ADMIN_GATE_COOKIE)?.value;
      const gateOk = await verifyAdminGateCookie(gate, gateSecret);
      if (!gateOk) {
        if (verifyAdminBasicAny(req.headers.get("authorization"), basicUser, basicPass, passAlt)) {
          const res = NextResponse.next();
          res.cookies.set(ADMIN_GATE_COOKIE, await createAdminGateCookie(gateSecret), {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            path: "/admin",
            maxAge: 12 * 60 * 60,
          });
          return res;
        }
        return new NextResponse("Unauthorized", {
          status: 401,
          headers: { "WWW-Authenticate": 'Basic realm="ably-admin", charset="UTF-8"' },
        });
      }
    }
  }

  if (isProtectedUserRoute(pathname)) {
    if (!hasSession) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
      }
      const welcomeUrl = req.nextUrl.clone();
      welcomeUrl.pathname = "/welcome";
      welcomeUrl.search = "";
      return NextResponse.redirect(welcomeUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon\\.ico).*)"],
};
