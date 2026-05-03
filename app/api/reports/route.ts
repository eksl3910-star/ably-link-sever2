import { NextResponse } from "next/server";
import { resolveUser } from "@/lib/session";
import { createReport, getSettings } from "@/lib/database";

export const runtime = "edge";

export async function POST(req: Request) {
  const { maintenanceOn } = await getSettings();
  if (maintenanceOn) {
    return NextResponse.json(
      { ok: false, error: "현재 점검 중입니다." },
      { status: 503 }
    );
  }

  const user = await resolveUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "인증이 필요합니다." }, { status: 401 });
  }

  let body: { targetId?: unknown; reason?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const targetId = typeof body.targetId === "string" ? body.targetId : "";
  const reason = typeof body.reason === "string" ? body.reason : "";
  if (!targetId) {
    return NextResponse.json({ ok: false, error: "targetId가 필요합니다." }, { status: 400 });
  }

  const result = await createReport(user.id, targetId, reason);
  if (!result.ok) {
    const msg =
      result.reason === "SELF"
        ? "본인을 신고할 수 없습니다."
        : "신고 사유를 입력해주세요.";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
