import { NextResponse } from "next/server";
import {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from "@/lib/database";
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

type Op = "list" | "create" | "update" | "delete";

export async function POST(req: Request) {
  let body: {
    password?: unknown;
    op?: unknown;
    id?: unknown;
    title?: unknown;
    body?: unknown;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (!checkAdminPassword(password)) {
    return NextResponse.json({ error: "관리자 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const op = body.op as Op;
  if (op !== "list" && op !== "create" && op !== "update" && op !== "delete") {
    return NextResponse.json(
      { error: "op는 list, create, update, delete 중 하나여야 합니다." },
      { status: 400 }
    );
  }

  try {
    if (op === "list") {
      const items = await listAnnouncements(100);
      return NextResponse.json({ ok: true, items });
    }

    if (op === "create") {
      const title = typeof body.title === "string" ? body.title : "";
      const text = typeof body.body === "string" ? body.body : "";
      const row = await createAnnouncement(title, text);
      return NextResponse.json({ ok: true, item: row });
    }

    if (op === "update") {
      const id = typeof body.id === "string" ? body.id : "";
      const title = typeof body.title === "string" ? body.title : "";
      const text = typeof body.body === "string" ? body.body : "";
      if (!id) {
        return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
      }
      const { ok } = await updateAnnouncement(id, title, text);
      if (!ok) {
        return NextResponse.json({ error: "해당 공지를 찾을 수 없습니다." }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    }

    const id = typeof body.id === "string" ? body.id : "";
    if (!id) {
      return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
    }
    const { ok } = await deleteAnnouncement(id);
    if (!ok) {
      return NextResponse.json({ error: "해당 공지를 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "공지 처리에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
