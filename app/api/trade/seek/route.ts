import { NextResponse } from "next/server";
import { resolveUser } from "@/lib/session";
import { getSettings, seekTradePartner } from "@/lib/database";

export const runtime = "edge";

export async function POST() {
  try {
    const { maintenanceOn } = await getSettings();
    if (maintenanceOn) {
      return NextResponse.json(
        { ok: false, error: "현재 점검 중입니다. 잠시 후 다시 시도해주세요." },
        { status: 503 }
      );
    }

    const user = await resolveUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "인증이 필요합니다." }, { status: 401 });
    }

    const result = await seekTradePartner(user.id);
    if (!result.ok) {
      const msg =
        result.reason === "NOT_ON_WAITLIST"
          ? "먼저 대기 명단에 등록해 주세요."
          : result.reason === "NO_USER_LINK"
            ? "마이페이지에서 오늘의 에이블리 링크를 등록해 주세요."
            : result.reason === "TRADE_TEMP_BAN"
              ? "신고 누적으로 12시간 동안 맞교할 수 없습니다."
              : result.reason === "PERMANENT_TRADE_BAN"
                ? "계정 제재로 맞교할 수 없습니다."
                : "서버 설정 오류입니다.";
      const status =
        result.reason === "TRADE_TEMP_BAN" || result.reason === "PERMANENT_TRADE_BAN"
          ? 403
          : 400;
      return NextResponse.json({ ok: false, reason: result.reason, error: msg }, { status });
    }

    if ("waiting" in result && result.waiting) {
      return NextResponse.json({ ok: true, waiting: true });
    }

    if ("link" in result && "transactionId" in result) {
      return NextResponse.json({
        ok: true,
        link: {
          id: result.link.id,
          url: result.link.url,
          deadline: result.link.deadline,
        },
        transactionId: result.transactionId,
      });
    }

    return NextResponse.json({ ok: false, error: "매칭 결과를 처리하지 못했습니다." }, { status: 500 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "맞교 매칭 중 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
