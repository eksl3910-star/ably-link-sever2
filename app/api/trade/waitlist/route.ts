import { NextResponse } from "next/server";
import { resolveUser } from "@/lib/session";
import {
  getSettings,
  getTradeRestriction,
  getTradeWaitlistStats,
  setTradeWaitlistEnrollment,
} from "@/lib/database";

export const runtime = "edge";

export async function GET() {
  const { maintenanceOn } = await getSettings();
  if (maintenanceOn) {
    return NextResponse.json({ error: "현재 점검 중입니다." }, { status: 503 });
  }

  const user = await resolveUser();
  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const s = await getTradeWaitlistStats(user.id);
  return NextResponse.json({ ok: true, count: s.count, enrolled: s.enrolled });
}

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

  let body: { enrolled?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다." }, { status: 400 });
  }

  const enrolled = Boolean(body.enrolled);
  if (enrolled) {
    const rule = await getTradeRestriction(user.id, Date.now());
    if (!rule.ok) {
      const msg =
        rule.kind === "permanent"
          ? "계정 제재로 거래 대기 명단에 등록할 수 없습니다."
          : "신고 누적으로 일정 시간 동안 거래 대기 명단을 이용할 수 없습니다.";
      return NextResponse.json({ ok: false, error: msg }, { status: 403 });
    }
  }
  await setTradeWaitlistEnrollment(user.id, enrolled);
  const s = await getTradeWaitlistStats(user.id);
  return NextResponse.json({ ok: true, count: s.count, enrolled: s.enrolled });
}
