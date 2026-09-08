import { NextRequest } from "next/server";
import { navigationFeed } from "@/core/opds";
import { handleRouteError, requireUser, unauthorized } from "@/server/auth";
import { clientIp, rateLimit, tooManyRequests } from "@/server/rate-limit";
import { requestOrigin } from "@/server/request-origin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    if (!rateLimit(`opds:${clientIp(req)}`, 60, 60)) return tooManyRequests();
    const user = await requireUser(req);
    if (!user) return unauthorized();
    const origin = requestOrigin(req);
    const now = new Date();
    const xml = navigationFeed({
      id: "urn:instapaper-opds:root",
      title: "Instapaper",
      selfUrl: `${origin}/opds`,
      entries: [
        {
          title: "Unread",
          href: `${origin}/opds/unread?page=1`,
          summary: "Articles you haven't archived yet",
          updated: now,
        },
        {
          title: "Starred",
          href: `${origin}/opds/starred?page=1`,
          summary: "Your starred articles",
          updated: now,
        },
        {
          title: "Archive",
          href: `${origin}/opds/archive?page=1`,
          summary: "Everything you've archived",
          updated: now,
        },
      ],
    });
    return new Response(xml, {
      headers: {
        "Content-Type":
          'application/atom+xml; charset=utf-8; profile=opds-catalog; kind=navigation',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
