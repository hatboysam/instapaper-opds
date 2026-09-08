import { NextRequest, NextResponse } from "next/server";
import {
  verifyPassword,
  hashPassword,
  updatePasswordHash,
  ConfigError,
} from "@/server/users";
import { requireWebUser, handleRouteError, invalidateAuthCache } from "@/server/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const record = await requireWebUser(req);
    if (!record) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const body = (await req.json()) as Record<string, unknown>;
    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters" },
        { status: 400 },
      );
    }
    if (!verifyPassword(currentPassword, record.passwordHash)) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });
    }
    await updatePasswordHash(record.username, hashPassword(newPassword));
    invalidateAuthCache(record.username);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ConfigError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
