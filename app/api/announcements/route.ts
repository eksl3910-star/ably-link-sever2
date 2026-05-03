import { NextResponse } from "next/server";
import { resolveUser } from "@/lib/session";
import { getSettings, listAnnouncements } from "@/lib/database";

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

  try {
    const items = await listAnnouncements(100);
    return NextResponse.json({ ok: true, items });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "공지를 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
