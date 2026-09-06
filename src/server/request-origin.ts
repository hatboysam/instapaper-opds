import type { NextRequest } from "next/server";

export function requestOrigin(req: NextRequest): string {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "")
    .split(",")[0]
    .trim();
  if (!host) return req.nextUrl.origin;
  const proto = (req.headers.get("x-forwarded-proto") ?? "https").split(",")[0].trim();
  return `${proto}://${host}`;
}

export function requestUrl(req: NextRequest): string {
  return `${requestOrigin(req)}${req.nextUrl.pathname}${req.nextUrl.search}`;
}
