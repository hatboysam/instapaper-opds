import { NextRequest, NextResponse } from "next/server";
import { updateInstapaperCredentials, ConfigError } from "@/server/users";
import { exchangeXAuthToken, InstapaperError } from "@/server/instapaper";
import { usernameFromRequest } from "@/server/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const username = usernameFromRequest(req);
    if (!username) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const body = (await req.json()) as Record<string, unknown>;
    const instapaperUsername = String(body.instapaperUsername ?? "").trim();
    const instapaperPassword = String(body.instapaperPassword ?? "");
    if (!instapaperUsername || !instapaperPassword) {
      return NextResponse.json(
        { error: "Instapaper email and password are required" },
        { status: 400 },
      );
    }
    const { token, tokenSecret } = await exchangeXAuthToken(
      instapaperUsername,
      instapaperPassword,
    );
    await updateInstapaperCredentials(username, {
      token,
      tokenSecret,
      instapaperUsername,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof InstapaperError) {
      return NextResponse.json(
        { error: `Instapaper rejected those credentials: ${err.message}` },
        { status: 400 },
      );
    }
    if (err instanceof ConfigError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
