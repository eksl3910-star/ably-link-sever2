import { NextResponse } from "next/server";
import { findUserByNickname, normalizeNickname } from "@/lib/database";
import { verifyKey } from "@/lib/password";
import { issueSession } from "@/lib/session";

export const runtime = "edge";

export async function POST(req: Request) {
  let body: { nickname?: unknown; password?: unknown; rememberMe?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const nickname = normalizeNickname(typeof body.nickname === "string" ? body.nickname : "");
  const password = typeof body.password === "string" ? body.password : "";

  if (!nickname || nickname.length < 2) {
    return NextResponse.json({ error: "닉네임을 입력해주세요." }, { status: 400 });
  }

  try {
    const user = await findUserByNickname(nickname);
    if (!user) {
      return NextResponse.json({ error: "닉네임 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    const valid = await verifyKey(password, user.pwHash, user.pwSalt);
    if (!valid) {
      return NextResponse.json({ error: "닉네임 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    const rememberMe = body.rememberMe === true;
    await issueSession(user.id, { rememberMe });
    return NextResponse.json({ ok: true, user: { id: user.id, nickname: user.nickname } });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "로그인 처리 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
