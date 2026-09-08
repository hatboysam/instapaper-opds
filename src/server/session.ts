import crypto from "node:crypto";

export const SESSION_COOKIE = "session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function sessionKey(): Buffer {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64 || !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error("TOKEN_ENCRYPTION_KEY is not configured");
  }
  return Buffer.from(hex, "hex");
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", sessionKey()).update(payload).digest("base64url");
}

export function signValue(payload: string): string {
  return sign(`hmac|${payload}`);
}

export function createSessionToken(username: string, version: number): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${username}.${version}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function parseSessionToken(
  token: string | undefined | null,
): { username: string; version: number } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [username, versionRaw, expRaw, sig] = parts;
  const version = Number.parseInt(versionRaw, 10);
  const exp = Number.parseInt(expRaw, 10);
  if (!Number.isSafeInteger(version) || !Number.isSafeInteger(exp) || exp * 1000 < Date.now()) {
    return null;
  }
  const expected = sign(`${username}.${versionRaw}.${expRaw}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return { username, version };
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
    sameSite: "lax" as const,
  };
}
