import { NextResponse } from "next/server";
import { bindUserClientId } from "@/lib/database";
import { resolveUser } from "@/lib/session";

export const runtime = "edge";

/** 로그인 세션으로 브라우저 클라이언트 ID를 계정에 묶어 영구 정지 시 재가입 차단에 사용 */
export async function POST(req: Request) {
  const user = await resolveUser();
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let body: { clientId?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
  if (!clientId) {
    return NextResponse.json({ ok: true });
  }

  await bindUserClientId(user.id, clientId);
  return NextResponse.json({ ok: true });
}
