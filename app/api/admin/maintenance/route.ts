import { NextResponse } from "next/server";
import { getSettings, setMaintenance, updateMaintenanceMessage } from "@/lib/database";
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
  let body: { password?: unknown; on?: unknown; maintenanceMessage?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (!checkAdminPassword(password)) {
    return NextResponse.json({ error: "관리자 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const hasOn = typeof body.on === "boolean";
  const hasMsg = typeof body.maintenanceMessage === "string";

  if (!hasOn && !hasMsg) {
    return NextResponse.json(
      { error: "점검 전환(on) 또는 maintenanceMessage(문자열) 중 하나 이상이 필요합니다." },
      { status: 400 }
    );
  }

  try {
    if (hasOn) {
      await setMaintenance(body.on as boolean);
    }
    if (hasMsg) {
      await updateMaintenanceMessage(body.maintenanceMessage as string);
    }

    const s = await getSettings();
    return NextResponse.json({
      ok: true,
      maintenanceOn: s.maintenanceOn,
      touchedAt: s.touchedAt,
      maintenanceMessage: s.maintenanceMessage,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "점검 설정을 저장하지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
