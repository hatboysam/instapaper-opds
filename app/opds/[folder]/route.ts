import { NextRequest, NextResponse } from "next/server";
import { acquisitionFeed, OpdsAcqEntry } from "@/core/opds";
import { slugify } from "@/core/slug";
import { handleRouteError, requireUser, unauthorized } from "@/server/auth";
import { fetchFolderPage, isFolder } from "@/server/catalog";
import { InstapaperError } from "@/server/instapaper";
import { bookParamsSignature } from "@/server/acquisition";
import { requestOrigin, requestUrl } from "@/server/request-origin";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ folder: string }> },
) {
  try {
    const user = await requireUser(req);
    if (!user) return unauthorized();
    const { folder } = await ctx.params;
    if (!isFolder(folder)) {
      return new NextResponse("Unknown folder", { status: 404 });
    }
    const params = req.nextUrl.searchParams;
    const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
    const size = Math.min(
      100,
      Math.max(10, Number.parseInt(params.get("size") ?? "50", 10) || 50),
    );
    const origin = requestOrigin(req);
    const { entries, hasMore } = await fetchFolderPage(
      { key: user.token, secret: user.tokenSecret },
      folder,
      page,
      size,
    );
    const nextUrl = hasMore
      ? `${origin}/opds/${folder}?page=${page + 1}&size=${size}`
      : undefined;
    const acqEntries: OpdsAcqEntry[] = entries.map((e) => {
      const slug = `${slugify(e.title, `article-${e.id}`)}-${e.id}`;
      const timestamp = String(Math.floor(e.time.getTime() / 1000));
      const signature = bookParamsSignature({
        id: e.id,
        title: e.title,
        url: e.url,
        timestamp,
      });
      const qs = new URLSearchParams();
      qs.set("t", e.title);
      if (e.url) qs.set("u", e.url);
      qs.set("ts", timestamp);
      qs.set("s", signature);
      return {
        id: `urn:instapaper:bookmark:${e.id}`,
        title: e.title,
        updated: e.time,
        summary: e.description,
        acquisitionHref: `${origin}/opds/book/${slug}.epub?${qs.toString()}`,
      };
    });
    const xml = acquisitionFeed({
      id: `urn:instapaper-opds:${folder}:page:${page}`,
      title: `Instapaper - ${folder[0].toUpperCase()}${folder.slice(1)} (page ${page})`,
      selfUrl: requestUrl(req),
      entries: acqEntries,
      nextUrl,
    });
    return new Response(xml, {
      headers: {
        "Content-Type":
          'application/atom+xml; charset=utf-8; profile=opds-catalog; kind=acquisition',
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
