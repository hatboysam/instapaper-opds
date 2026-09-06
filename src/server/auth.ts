import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getUser, verifyPassword, ConfigError } from "./users";

export interface BasicUser {
  username: string;
  token: string;
  tokenSecret: string;
}

export async function requireUser(req: NextRequest): Promise<BasicUser | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Basic ")) return null;
  let username: string;
  let password: string;
  try {
    const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    if (idx < 0) return null;
    username = decoded.slice(0, idx);
    password = decoded.slice(idx + 1);
  } catch {
    return null;
  }
  if (!username.includes("@") && !/^[a-z0-9_-]+$/i.test(username)) return null;
  const record = await getUser(username.toLowerCase());
  if (!record || !verifyPassword(password, record.passwordHash)) return null;
  return {
    username: record.username,
    token: record.token,
    tokenSecret: record.tokenSecret,
  };
}

export function unauthorized(): NextResponse {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="instapaper-xteink", charset="UTF-8"',
    },
  });
}

export function handleRouteError(err: unknown): NextResponse {
  if (err instanceof ConfigError) {
    return NextResponse.json({ error: err.message }, { status: 503 });
  }
  console.error(err);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
