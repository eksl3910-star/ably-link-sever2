import { NextResponse } from "next/server";
import { resolveUser } from "@/lib/session";
import { getSettings, parseAblyUrl, isDuplicateLink, enqueueLink } from "@/lib/database";

export const runtime = "edge";

export async function POST(req: Request) {
  const { maintenanceOn } = await getSettings();
  if (maintenanceOn) {
    return NextResponse.json({ error: "현재 점검 중입니다. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }

  const user = await resolveUser();
  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  let body: { text?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text : "";
  const url = parseAblyUrl(text);

  if (!url) {
    return NextResponse.json(
      { error: "에이블리 링크(a-bly.com)만 올릴 수 있어요." },
      { status: 400 }
    );
  }

  const duplicate = await isDuplicateLink(user.id, url);
  if (duplicate) {
    return NextResponse.json({ error: "이미 대기열에 있는 링크예요." }, { status: 409 });
  }

  const { id } = await enqueueLink(user.id, url);
  return NextResponse.json({ ok: true, id, url });
}
