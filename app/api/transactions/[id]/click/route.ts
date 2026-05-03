import { NextResponse } from "next/server";
import { resolveUser } from "@/lib/session";
import { getSettings, recordPeerLinkClick } from "@/lib/database";

export const runtime = "edge";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Params) {
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

  const result = await recordPeerLinkClick(id, user.id);
  if (!result.ok) {
    const status =
      result.reason === "FORBIDDEN"
        ? 403
        : result.reason === "NOT_FOUND"
          ? 404
          : result.reason === "EXPIRED"
            ? 410
            : 409;
    return NextResponse.json({ ok: false, reason: result.reason }, { status });
  }

  return NextResponse.json({ ok: true, status: result.status });
}
