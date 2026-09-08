import { NextRequest, NextResponse } from "next/server";
import { getUser, verifyPassword, ConfigError } from "@/server/users";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
} from "@/server/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const username = String(body.username ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
    }
    const record = await getUser(username);
    if (!record || !verifyPassword(password, record.passwordHash)) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true, username: record.username });
    res.cookies.set(
      SESSION_COOKIE,
      createSessionToken(record.username, record.sessionVersion),
      sessionCookieOptions(),
    );
    return res;
  } catch (err) {
    if (err instanceof ConfigError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
