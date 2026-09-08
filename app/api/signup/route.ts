import { NextRequest, NextResponse } from "next/server";
import {
  createUser,
  findUsernameByInstapaperUserId,
  isValidUsername,
  ConfigError,
} from "@/server/users";
import { exchangeXAuthToken, InstapaperError } from "@/server/instapaper";
import { checkRateLimit, clientIp } from "@/server/throttle";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    if (!checkRateLimit(`signup:${clientIp(req)}`, 10, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many signups — try again later" }, { status: 429 });
    }
    const body = (await req.json()) as Record<string, unknown>;
    const username = String(body.username ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const instapaperUsername = String(body.instapaperUsername ?? "").trim();
    const instapaperPassword = String(body.instapaperPassword ?? "");

    if (!isValidUsername(username)) {
      return NextResponse.json(
        { error: "Username must be 3-32 chars: letters, numbers, - or _" },
        { status: 400 },
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }
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
      if (existing && existing !== username) {
        return NextResponse.json(
          { error: "That Instapaper account is already registered" },
          { status: 409 },
        );
      }
    }
    await createUser({
      username,
      password,
      token,
      tokenSecret,
      instapaperUsername,
      instapaperUserId: userId,
    });
    return NextResponse.json({ ok: true, username });
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
    if (err instanceof Error && ((err as { code?: number }).code === 6 || /ALREADY_EXISTS|already exists/i.test(err.message))) {
      return NextResponse.json(
        { error: "That username is already taken" },
        { status: 409 },
      );
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
