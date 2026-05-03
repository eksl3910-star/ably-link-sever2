import { NextResponse } from "next/server";
import { resolveUser } from "@/lib/session";
import {
  getSettings,
  getUserAccount,
  isUserBanned,
  needsDailyLinkRegistration,
  updateUserProfileLink,
} from "@/lib/database";
import { parseAndValidateAblyUrl } from "@/lib/ably-link";

export const runtime = "edge";

export async function GET() {
  const { maintenanceOn } = await getSettings();
  if (maintenanceOn) {
    return NextResponse.json(
      { error: "현재 점검 중입니다. 잠시 후 다시 시도해주세요." },
      { status: 503 }
    );
  }

  const user = await resolveUser();
  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const account = await getUserAccount(user.id);
    if (!account) {
      return NextResponse.json({ error: "프로필을 불러오지 못했습니다." }, { status: 500 });
    }
    const now = Date.now();
    const banned = isUserBanned(account, now);
    return NextResponse.json({
      ok: true,
      link: account.link,
      lastLinkUpdate: account.lastLinkUpdate,
      needsDailyRegistration: needsDailyLinkRegistration(account.lastLinkUpdate, now),
      banned,
      banUntil: account.banUntil,
      permanentBan: account.accountStatus === "permanent_ban",
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "DB 스키마가 최신이 아닙니다. migrations/0005_users_transactions_reports.sql 을 D1에 적용했는지 확인해주세요.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  const { maintenanceOn } = await getSettings();
  if (maintenanceOn) {
    return NextResponse.json(
      { error: "현재 점검 중입니다. 잠시 후 다시 시도해주세요." },
      { status: 503 }
    );
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
  const url = parseAndValidateAblyUrl(text);
  if (!url) {
    return NextResponse.json(
      { error: "에이블리 링크(a-bly.com)만 등록할 수 있어요." },
      { status: 400 }
    );
  }

  try {
    const account = await getUserAccount(user.id);
    if (!account) {
      return NextResponse.json({ error: "프로필을 불러오지 못했습니다." }, { status: 500 });
    }
    if (isUserBanned(account, Date.now())) {
      return NextResponse.json({ error: "이용이 제한된 계정입니다." }, { status: 403 });
    }

    await updateUserProfileLink(user.id, url);
    return NextResponse.json({ ok: true, url });
  } catch {
    return NextResponse.json(
      {
        error:
          "DB 스키마가 최신이 아닙니다. migrations/0005_users_transactions_reports.sql 을 D1에 적용했는지 확인해주세요.",
      },
      { status: 500 }
    );
  }
}
