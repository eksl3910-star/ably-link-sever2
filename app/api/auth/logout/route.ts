import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";
import { isAccountControlsLocked, lookupSession } from "@/lib/database";
import { revokeSession } from "@/lib/session";

export const runtime = "edge";

export async function POST() {
  const store = await cookies();
  const sessionId = store.get(SESSION_COOKIE)?.value ?? "";
  if (!sessionId) {
    return NextResponse.json({ ok: true });
  }

  const session = await lookupSession(sessionId);
  if (!session) {
    await revokeSession();
    return NextResponse.json({ ok: true });
  }

  if (await isAccountControlsLocked(session.userId)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "신고 누적으로 로그아웃할 수 없습니다. 문의가 필요하면 고객센터를 이용해 주세요.",
      },
      { status: 403 }
    );
  }

  await revokeSession();
  return NextResponse.json({ ok: true });
}
