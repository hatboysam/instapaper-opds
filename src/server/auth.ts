import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getUser, verifyPassword, UserRecord, ConfigError } from "./users";
import { SESSION_COOKIE, parseSessionToken } from "./session";

export interface BasicUser {
  username: string;
  token: string;
  tokenSecret: string;
  getTextBlocked: boolean;
}

const AUTH_USERNAME_RE = /^[a-z0-9][a-z0-9_-]{2,31}$/;
const AUTH_CACHE_TTL_MS = 10 * 60 * 1000;
const AUTH_CACHE_MAX = 2000;

interface AuthCacheEntry {
  user: BasicUser;
  expires: number;
}

const authCache = new Map<string, AuthCacheEntry>();
const DUMMY_SALT = "a6f3c1d90b7e2451";

function toBasicUser(record: UserRecord): BasicUser {
  return {
    username: record.username,
    token: record.token,
    tokenSecret: record.tokenSecret,
    getTextBlocked: record.getTextBlocked,
  };
}

export function invalidateAuthCache(username: string): void {
  for (const key of authCache.keys()) {
    if (key.startsWith(`${username}:`)) authCache.delete(key);
  }
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
    username = decoded.slice(0, idx).toLowerCase();
    password = decoded.slice(idx + 1);
  } catch {
    return null;
  }
  if (!AUTH_USERNAME_RE.test(username)) return null;

  const passwordHash = crypto.createHash("sha256").update(password).digest("hex");
  const cacheKey = `${username}:${passwordHash}`;
  const hit = authCache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return hit.user;

  let user: BasicUser | null = null;
  const record = await getUser(username);
  if (record && verifyPassword(password, record.passwordHash)) {
    user = toBasicUser(record);
  } else {
    crypto.scryptSync(password, DUMMY_SALT, 64);
  }

  if (user) {
    if (authCache.size >= AUTH_CACHE_MAX) {
      const oldest = authCache.keys().next().value;
      if (oldest) authCache.delete(oldest);
    }
    authCache.set(cacheKey, { user, expires: Date.now() + AUTH_CACHE_TTL_MS });
  }
  return user;
}

export async function requireWebUser(req: NextRequest): Promise<UserRecord | null> {
  const parsed = parseSessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!parsed) return null;
  const record = await getUser(parsed.username);
  if (!record) return null;
  if (parsed.version !== record.sessionVersion) return null;
  return record;
}

export function unauthorized(): NextResponse {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="instapaper-opds", charset="UTF-8"',
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
