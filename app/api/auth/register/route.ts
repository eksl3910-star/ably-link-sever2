import { NextResponse } from "next/server";
import {
  bindUserClientId,
  findUserByNickname,
  insertUser,
  isClientIdBlocked,
  normalizeNickname,
  validateNicknameRules,
} from "@/lib/database";
import { deriveKey } from "@/lib/password";
import { issueSession } from "@/lib/session";

export const runtime = "edge";

export async function POST(req: Request) {
  let body: {
    nickname?: unknown;
    password?: unknown;
    passwordConfirm?: unknown;
    clientId?: unknown;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const nickname = normalizeNickname(typeof body.nickname === "string" ? body.nickname : "");
  const password = typeof body.password === "string" ? body.password : "";
  const passwordConfirm =
    typeof body.passwordConfirm === "string" ? body.passwordConfirm : "";
  const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";

  const nickErr = validateNicknameRules(nickname);
  if (nickErr) {
    return NextResponse.json({ error: nickErr }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "비밀번호는 8자 이상이어야 합니다." }, { status: 400 });
  }
  if (password !== passwordConfirm) {
    return NextResponse.json({ error: "비밀번호 확인이 일치하지 않습니다." }, { status: 400 });
  }

  try {
    const existing = await findUserByNickname(nickname);
    if (existing) {
      return NextResponse.json({ error: "이미 사용 중인 닉네임입니다." }, { status: 409 });
    }

    if (clientId && (await isClientIdBlocked(clientId))) {
      return NextResponse.json(
        { error: "이 기기에서는 새 계정을 만들 수 없습니다." },
        { status: 403 }
      );
    }

    const { hash, salt } = await deriveKey(password);
    const user = await insertUser(nickname, hash, salt);
    await issueSession(user.id, { rememberMe: true });
    if (clientId) await bindUserClientId(user.id, clientId);

    return NextResponse.json({ ok: true, user: { id: user.id, nickname: user.nickname } });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "회원가입 처리 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
