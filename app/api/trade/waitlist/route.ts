import { NextResponse } from "next/server";
import { resolveUser } from "@/lib/session";
import { getSettings, getTradeWaitlistStats, setTradeWaitlistEnrollment } from "@/lib/database";

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
  await setTradeWaitlistEnrollment(user.id, enrolled);
  const s = await getTradeWaitlistStats(user.id);
  return NextResponse.json({ ok: true, count: s.count, enrolled: s.enrolled });
}
