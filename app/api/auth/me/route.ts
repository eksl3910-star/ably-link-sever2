import { NextResponse } from "next/server";
import { isAccountControlsLocked } from "@/lib/database";
import { resolveUser } from "@/lib/session";

export const runtime = "edge";

export async function GET() {
  const user = await resolveUser();
  if (!user) {
    return NextResponse.json({ ok: false, user: null }, { status: 401 });
  }
  const accountControlsLocked = await isAccountControlsLocked(user.id);
  return NextResponse.json({
    ok: true,
    user: { id: user.id, nickname: user.nickname },
    accountControlsLocked,
  });
}
