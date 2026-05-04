import { NextResponse } from "next/server";
import { bumpEntryGateForceAt, getSettings } from "@/lib/database";
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
  let body: { password?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (!checkAdminPassword(password)) {
    return NextResponse.json({ error: "관리자 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  try {
    const entryGateForceAt = await bumpEntryGateForceAt();
    const s = await getSettings();
    return NextResponse.json({
      ok: true,
      entryGateForceAt,
      touchedAt: s.touchedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "처리하지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
