import { NextResponse } from "next/server";

interface Bucket {
  tokens: number;
  updatedAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5000;
let lastPrune = 0;

export function clientIp(req: { headers: { get(name: string): string | null } }): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }
  return "unknown";
}

export function rateLimit(
  key: string,
  capacity: number,
  refillPerMinute: number,
): boolean {
  const now = Date.now();
  if (buckets.size > MAX_BUCKETS || now - lastPrune > 60000) {
    for (const [k, b] of buckets) {
      if (now - b.updatedAt > 15 * 60000) buckets.delete(k);
    }
    lastPrune = now;
  }
  const bucket = buckets.get(key) ?? { tokens: capacity, updatedAt: now };
  const elapsedMinutes = (now - bucket.updatedAt) / 60000;
  bucket.tokens = Math.min(capacity, bucket.tokens + elapsedMinutes * refillPerMinute);
  bucket.updatedAt = now;
  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    return false;
  }
  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return true;
}

export function tooManyRequests(): NextResponse {
  return NextResponse.json(
    { error: "Too many requests — slow down" },
    { status: 429, headers: { "Retry-After": "60" } },
  );
}
