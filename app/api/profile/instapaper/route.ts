import { NextRequest, NextResponse } from "next/server";
import {
  updateInstapaperCredentials,
  findUsernameByInstapaperUserId,
  ConfigError,
} from "@/server/users";
import { exchangeXAuthToken, InstapaperError } from "@/server/instapaper";
import { requireWebUser, handleRouteError, invalidateAuthCache } from "@/server/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const record = await requireWebUser(req);
    if (!record) {
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
    const { token, tokenSecret, userId } = await exchangeXAuthToken(
      instapaperUsername,
      instapaperPassword,
    );
    if (userId !== undefined) {
      const existing = await findUsernameByInstapaperUserId(userId);
      if (existing && existing !== record.username) {
        return NextResponse.json(
          { error: "That Instapaper account is already registered" },
          { status: 409 },
        );
      }
    }
    await updateInstapaperCredentials(record.username, {
      token,
      tokenSecret,
      instapaperUsername,
      instapaperUserId: userId,
    });
    invalidateAuthCache(record.username);
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
