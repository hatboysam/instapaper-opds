import type { NextRequest } from "next/server";

// Minimal in-memory abuse throttle. Defense-in-depth behind Cloudflare;
// per-instance only (maxInstances 3), so limits are approximate.

const hits = new Map<string, number[]>();

function touch(key: string, windowMs: number): number[] {
  const now = Date.now();
  const times = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.set(key, times);
  if (hits.size > 5000) {
    const oldest = hits.keys().next().value;
    if (oldest) hits.delete(oldest);
  }
  return times;
}

/** Generic check-and-record: allow up to `limit` events per `windowMs`. */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const times = touch(key, windowMs);
  if (times.length >= limit) return false;
  times.push(Date.now());
  return true;
}

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim() || "unknown";
  return "unknown";
}

const AUTH_FAIL_LIMIT = 60;
const AUTH_FAIL_WINDOW_MS = 10 * 60 * 1000;
const authFailKey = (ip: string) => `authfail:${ip}`;

/** True when this IP has failed auth too often — caller should reject fast. */
export function isAuthThrottled(ip: string): boolean {
  return touch(authFailKey(ip), AUTH_FAIL_WINDOW_MS).length >= AUTH_FAIL_LIMIT;
}

export function recordAuthFailure(ip: string): void {
  touch(authFailKey(ip), AUTH_FAIL_WINDOW_MS).push(Date.now());
}
