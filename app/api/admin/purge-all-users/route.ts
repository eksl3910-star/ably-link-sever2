import { NextResponse } from "next/server";
import { PURGE_ALL_USERS_CONFIRM_PHRASE } from "@/lib/admin-purge-constants";
import { purgeAllUsersAndRelatedData } from "@/lib/database";
import { timingSafeCompare } from "@/lib/password";
import { ADMIN_PASS_ENVS } from "@/lib/constants";

export const runtime = "edge";

function checkAdminPassword(input: string): boolean {
  for (const key of ADMIN_PASS_ENVS) {
    const expected = process.env[key] ?? "";
    if (expected && timingSafeCompare(input, expected)) return true;
  }
  return false;
}

export async function POST(req: Request) {
  let body: { password?: unknown; confirm?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (!checkAdminPassword(password)) {
    return NextResponse.json({ error: "관리자 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const confirm = typeof body.confirm === "string" ? body.confirm : "";
  if (!timingSafeCompare(confirm, PURGE_ALL_USERS_CONFIRM_PHRASE)) {
    return NextResponse.json(
      {
        error: `확인 문구가 올바르지 않습니다. 관리자 문서에 안내된 문구를 그대로 입력하세요.`,
      },
      { status: 400 }
    );
  }

  try {
    await purgeAllUsersAndRelatedData();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "삭제 처리 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
