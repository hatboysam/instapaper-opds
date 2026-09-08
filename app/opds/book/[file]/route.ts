import { NextRequest, NextResponse } from "next/server";
import { handleRouteError, requireUser, unauthorized } from "@/server/auth";
import { buildBookEpub } from "@/server/catalog";
import { InstapaperError } from "@/server/instapaper";
import { verifyBookParams } from "@/server/acquisition";
import { clientIp, rateLimit, tooManyRequests } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

const FILE_RE = /^(.+)-(\d+)\.epub$/i;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ file: string }> },
) {
  try {
    if (!rateLimit(`opds:${clientIp(req)}`, 60, 60)) return tooManyRequests();
    const user = await requireUser(req);
    if (!user) return unauthorized();
    if (!rateLimit(`dl:${user.username}`, 30, 0.5)) return tooManyRequests();

    const { file } = await ctx.params;
    const match = FILE_RE.exec(decodeURIComponent(file));
    if (!match) {
      return new NextResponse("Invalid book path", { status: 404 });
    }
    const bookmarkId = Number.parseInt(match[2], 10);
    if (!Number.isSafeInteger(bookmarkId) || bookmarkId <= 0) {
      return new NextResponse("Invalid bookmark id", { status: 404 });
    }
    const params = req.nextUrl.searchParams;
    const title = params.get("t") ?? "";
    const url = params.get("u") ?? "";
    const ts = params.get("ts") ?? "";
    if (!verifyBookParams({ id: bookmarkId, title, url, timestamp: ts }, params.get("s"))) {
      return new NextResponse("Invalid book link — refresh the catalog", { status: 400 });
    }
    const { bytes, filename } = await buildBookEpub(user, bookmarkId, match[1], {
      title: title || undefined,
      url: url || undefined,
      timestamp: Number.parseInt(ts, 10) || 0,
    });
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/epub+zip",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof InstapaperError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    return handleRouteError(err);
  }
}
