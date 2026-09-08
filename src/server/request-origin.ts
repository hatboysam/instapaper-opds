import type { NextRequest } from "next/server";
import { SITE_URL } from "@/lib/site";

function hostnameOf(host: string): string {
  return host.toLowerCase().split(":")[0].trim();
}

function isAllowedHost(host: string): boolean {
  const h = hostnameOf(host);
  if (!h) return false;
  if (h === "instaopds.com" || h === "www.instaopds.com") return true;
  if (h === "localhost" || h === "127.0.0.1" || h === "::1") return true;
  if (h.endsWith(".hosted.app")) return true;
  return false;
}

export function requestOrigin(req: NextRequest): string {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "")
    .split(",")[0]
    .trim();
  if (!isAllowedHost(host)) return SITE_URL;
  const rawProto = (req.headers.get("x-forwarded-proto") ?? "").split(",")[0].trim();
  const proto = rawProto || (hostnameOf(host) === "localhost" ? "http" : "https");
  return `${proto}://${host}`;
}

export function requestUrl(req: NextRequest): string {
  return `${requestOrigin(req)}${req.nextUrl.pathname}${req.nextUrl.search}`;
}
