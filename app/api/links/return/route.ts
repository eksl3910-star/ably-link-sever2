import { NextResponse } from "next/server";
import { resolveUser } from "@/lib/session";
import { getSettings, releaseLink } from "@/lib/database";

export const runtime = "edge";

export async function POST(req: Request) {
  const { maintenanceOn } = await getSettings();
  if (maintenanceOn) {
    return NextResponse.json({ error: "현재 점검 중입니다." }, { status: 503 });
  }

  const user = await resolveUser();
  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  let body: { linkId?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const linkId = typeof body.linkId === "string" ? body.linkId : "";
  if (!linkId) {
    return NextResponse.json({ error: "linkId가 필요합니다." }, { status: 400 });
  }

  const result = await releaseLink(user.id, linkId);
  return NextResponse.json({ ok: result.ok });
}
