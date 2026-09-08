import { NextRequest, NextResponse } from "next/server";
import { getProfileInfo, ConfigError } from "@/server/users";
import { usernameFromRequest } from "@/server/session";
import { OPDS_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const username = usernameFromRequest(req);
    if (!username) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const profile = await getProfileInfo(username);
    if (!profile) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    return NextResponse.json({ ...profile, opdsUrl: OPDS_URL });
  } catch (err) {
    if (err instanceof ConfigError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
