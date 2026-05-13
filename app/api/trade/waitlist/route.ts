import { NextResponse } from "next/server";
import { resolveUser } from "@/lib/session";
import {
  countCompletedTradesInKstDay,
  getSettings,
  getTradeRestriction,
  getTradeWaitlistStats,
  setTradeWaitlistEnrollment,
} from "@/lib/database";
import { TEMP_DAILY_TRADE_COMPLETED_LIMIT } from "@/lib/constants";

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
  return NextResponse.json({
    ok: true,
    count: s.count,
    enrolled: s.enrolled,
    tradeDailyCompleted: s.tradeDailyCompleted,
    tradeDailyLimit: s.tradeDailyLimit,
    tradeDailyRemaining: s.tradeDailyRemaining,
  });
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
  const now = Date.now();
  if (enrolled) {
    const rule = await getTradeRestriction(user.id, now);
    if (!rule.ok) {
      const msg =
        rule.kind === "permanent"
          ? "계정 제재로 맞교 대기 명단에 등록할 수 없습니다."
          : "신고 누적으로 일정 시간 동안 맞교 대기 명단을 이용할 수 없습니다.";
      return NextResponse.json({ ok: false, error: msg }, { status: 403 });
    }
    const completedToday = await countCompletedTradesInKstDay(user.id, now);
    if (completedToday >= TEMP_DAILY_TRADE_COMPLETED_LIMIT) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "오늘(한국 시간 기준) 완료한 맞교가 상한에 도달하여 대기 명단에 등록할 수 없습니다. 내일 다시 이용해 주세요.",
        },
        { status: 403 }
      );
    }
  }
  await setTradeWaitlistEnrollment(user.id, enrolled);
  const s = await getTradeWaitlistStats(user.id);
  return NextResponse.json({
    ok: true,
    count: s.count,
    enrolled: s.enrolled,
    tradeDailyCompleted: s.tradeDailyCompleted,
    tradeDailyLimit: s.tradeDailyLimit,
    tradeDailyRemaining: s.tradeDailyRemaining,
  });
}
