import { NextResponse } from "next/server";
import { resolveUser, revokeSession } from "@/lib/session";
import { removeUserAndData } from "@/lib/database";

export const runtime = "edge";

export async function DELETE() {
  const user = await resolveUser();
  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  await removeUserAndData(user.id);
  await revokeSession();

  return NextResponse.json({ ok: true });
}
