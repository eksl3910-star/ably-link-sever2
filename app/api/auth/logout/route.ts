import { NextResponse } from "next/server";
import { revokeSession } from "@/lib/session";

export const runtime = "edge";

export async function POST() {
  await revokeSession();
  return NextResponse.json({ ok: true });
}
