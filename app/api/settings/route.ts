import { NextResponse } from "next/server";
import { getSettings } from "@/lib/database";

export const runtime = "edge";

export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json(
      {
        maintenanceOn: settings.maintenanceOn,
        touchedAt: settings.touchedAt,
        maintenanceMessage: settings.maintenanceMessage,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=15, stale-while-revalidate=45",
        },
      }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "설정을 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
