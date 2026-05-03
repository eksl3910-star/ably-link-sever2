import { NextResponse } from "next/server";
import { setEntryGateAblyUrl } from "@/lib/database";
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
  let body: { password?: unknown; url?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  const rawUrl = typeof body.url === "string" ? body.url : "";

  if (!checkAdminPassword(password)) {
    return NextResponse.json({ error: "관리자 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  try {
    const result = await setEntryGateAblyUrl(rawUrl);
    if (!result.ok) {
      return NextResponse.json(
        {
          error:
            "에이블리 링크(https://… 로 시작하고 a-bly.com 도메인)만 설정할 수 있습니다.",
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true, entryGateAblyUrl: result.url });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "설정을 저장하지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
