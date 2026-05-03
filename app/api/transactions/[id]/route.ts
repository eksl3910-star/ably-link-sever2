import { NextResponse } from "next/server";
import { resolveUser } from "@/lib/session";
import { buildTransactionClientView, getSettings, markTransactionPresence } from "@/lib/database";

export const runtime = "edge";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Params) {
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

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "transaction id가 필요합니다." }, { status: 400 });
  }

  await markTransactionPresence(id, user.id);

  const now = Date.now();
  const view = await buildTransactionClientView(id, user.id, now);
  if (!view) {
    return NextResponse.json({ ok: false, error: "거래를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, ...view });
}
