import { NextResponse } from "next/server";
import { countReportsAgainstUser } from "@/lib/database";
import { resolveUser } from "@/lib/session";

export const runtime = "edge";

/** 로그인 사용자가 신고를 받은 총 누적 건수 (피신고자 기준) */
export async function GET() {
  const user = await resolveUser();
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const count = await countReportsAgainstUser(user.id);
  return NextResponse.json({ ok: true, count });
}
