import { NextResponse } from "next/server";
import { resolveUser } from "@/lib/session";
import { getSettings, acquireLink } from "@/lib/database";

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

    const result = await acquireLink(user.id);
    if (!result.ok) {
      const extra =
        result.reason === "NO_USER_LINK"
          ? "거래를 시작하려면 먼저 오늘의 에이블리 링크를 등록해 주세요. (메인 또는 마이페이지)"
          : result.reason === "NO_TX_TABLE"
            ? "transactions 테이블이 없습니다. D1에 migrations/0005_users_transactions_reports.sql 을 적용해 주세요."
            : undefined;
      return NextResponse.json({ ok: false, reason: result.reason, error: extra });
    }

    return NextResponse.json({
      ok: true,
      link: {
        id: result.link.id,
        url: result.link.url,
        deadline: result.link.deadline,
      },
      transactionId: result.transactionId,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "링크를 받는 중 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
