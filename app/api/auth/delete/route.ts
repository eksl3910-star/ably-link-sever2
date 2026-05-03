import { NextResponse } from "next/server";
import { isAccountControlsLocked, removeUserAndData } from "@/lib/database";
import { resolveUser, revokeSession } from "@/lib/session";

export const runtime = "edge";

export async function DELETE() {
  const user = await resolveUser();
  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  if (await isAccountControlsLocked(user.id)) {
    return NextResponse.json(
      {
        error:
          "신고 누적으로 탈퇴할 수 없습니다. 문의가 필요하면 고객센터를 이용해 주세요.",
      },
      { status: 403 }
    );
  }

  await removeUserAndData(user.id);
  await revokeSession();

  return NextResponse.json({ ok: true });
}
