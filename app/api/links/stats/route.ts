import { NextResponse } from "next/server";
import { resolveUser } from "@/lib/session";
import { getSettings, getLinkCounts } from "@/lib/database";

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

  const counts = await getLinkCounts(user.id);
  return NextResponse.json({ ok: true, total: counts.total, mine: counts.mine });
}
