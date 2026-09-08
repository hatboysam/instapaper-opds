import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, parseSessionToken } from "@/server/session";
import { incrementSessionVersion } from "@/server/users";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const store = await cookies();
    const parsed = parseSessionToken(store.get(SESSION_COOKIE)?.value);
    if (parsed) await incrementSessionVersion(parsed.username);
  } catch {
    /* best effort — still clear the cookie below */
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
