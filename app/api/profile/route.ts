import { NextRequest, NextResponse } from "next/server";
import { requireWebUser, handleRouteError } from "@/server/auth";
import { OPDS_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const record = await requireWebUser(req);
    if (!record) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    return NextResponse.json({
      username: record.username,
      instapaperUsername: record.instapaperUsername,
      createdAt: record.createdAt,
      opdsUrl: OPDS_URL,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
