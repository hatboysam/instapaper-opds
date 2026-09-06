import { NextRequest, NextResponse } from "next/server";
import { handleRouteError, requireUser, unauthorized } from "@/server/auth";
import { buildBookEpub } from "@/server/catalog";
import { InstapaperError } from "@/server/instapaper";

export const dynamic = "force-dynamic";

const FILE_RE = /^(.+)-(\d+)\.epub$/i;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ file: string }> },
) {
  try {
    const user = await requireUser(req);
    if (!user) return unauthorized();
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
    const title = params.get("t") ?? undefined;
    const url = params.get("u") ?? undefined;
    const ts = Number.parseInt(params.get("ts") ?? "0", 10) || 0;
    const { bytes, filename } = await buildBookEpub(
      { key: user.token, secret: user.tokenSecret },
      bookmarkId,
      match[1],
      {
        title,
        url,
        timestamp: ts,
      },
    );
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
