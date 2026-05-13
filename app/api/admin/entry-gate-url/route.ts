import { NextResponse } from "next/server";
import { getSettings, setEntryGateAblyUrl, setEntryGateEnabled } from "@/lib/database";
import { ADMIN_PASS_ENVS } from "@/lib/constants";
import { timingSafeCompare } from "@/lib/password";

export const runtime = "edge";

function checkAdminPassword(input: string): boolean {
  for (const key of ADMIN_PASS_ENVS) {
    const expected = process.env[key] ?? "";
    if (expected && timingSafeCompare(input, expected)) return true;
  }
  return false;
}

export async function POST(req: Request) {
  let body: { password?: unknown; url?: unknown; enabled?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  const rawUrl = typeof body.url === "string" ? body.url : undefined;
  const enabledRaw = body.enabled;

  if (!checkAdminPassword(password)) {
    return NextResponse.json({ error: "관리자 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const hasEnabled = typeof enabledRaw === "boolean";
  const hasUrl = rawUrl !== undefined && rawUrl.trim() !== "";

  if (!hasEnabled && !hasUrl) {
    return NextResponse.json(
      { error: "url(문자열) 또는 enabled(참/거짓) 중 하나 이상을 보내주세요." },
      { status: 400 }
    );
  }

  try {
    if (hasEnabled) {
      await setEntryGateEnabled(enabledRaw as boolean);
    }

    if (hasUrl) {
      const result = await setEntryGateAblyUrl(rawUrl!.trim());
      if (!result.ok) {
        return NextResponse.json(
          {
            error:
              "https://applink.a-bly.com/ 로 시작하는 에이블리 앱 링크만 설정할 수 있습니다.",
          },
          { status: 400 }
        );
      }
    }

    const s = await getSettings();
    return NextResponse.json({
      ok: true,
      entryGateAblyUrl: s.entryGateAblyUrl,
      entryGateEnabled: s.entryGateEnabled,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "설정을 저장하지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
