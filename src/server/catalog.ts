import {
  getBookmarkText,
  InstapaperBookmark,
  InstapaperError,
  listBookmarks,
} from "./instapaper";
import { extractArticle, toXhtmlFragment } from "../core/extract";
import { buildEpub } from "../core/epub";
import { slugify } from "../core/slug";

const BLOCK = 500;

export const FOLDERS = ["unread", "starred", "archive"] as const;
export type FolderId = (typeof FOLDERS)[number];

export function isFolder(value: string): value is FolderId {
  return (FOLDERS as readonly string[]).includes(value);
}

export interface CatalogEntry {
  id: number;
  title: string;
  url: string;
  description?: string;
  time: Date;
}

function toEntry(b: InstapaperBookmark): CatalogEntry {
  const ts = b.time ?? b.progress_timestamp ?? 0;
  return {
    id: b.bookmark_id,
    title: b.title || `Article ${b.bookmark_id}`,
    url: b.url,
    description: b.description,
    time: ts > 0 ? new Date(ts * 1000) : new Date(),
  };
}

export async function fetchFolderPage(
  token: { key: string; secret: string },
  folder: FolderId,
  page: number,
  size: number,
): Promise<{ entries: CatalogEntry[]; hasMore: boolean }> {
  const needed = page * size;
  const blocks = Math.ceil(needed / BLOCK);
  let all: InstapaperBookmark[] = [];
  let have: string[] = [];
  for (let i = 0; i < blocks; i++) {
    const res = await listBookmarks(token, {
      folderId: folder,
      limit: BLOCK,
      have,
    });
    all = all.concat(res.bookmarks);
    if (res.bookmarks.length < BLOCK) break;
    have = all.map((b) => String(b.bookmark_id));
  }
  const slice = all.slice((page - 1) * size, page * size);
  return { entries: slice.map(toEntry), hasMore: slice.length === size };
}

export interface BookOptions {
  title?: string;
  url?: string;
  timestamp?: number;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function titleFromHtml(html: string): string | undefined {
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (titleMatch?.[1]?.trim()) return titleMatch[1].trim();
  const h1Match = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  if (h1Match?.[1]?.trim()) {
    return h1Match[1].replace(/<[^>]+>/g, "").trim();
  }
  return undefined;
}

function domainAuthor(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

async function fetchOriginalArticle(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; instapaper-xteink/0.1; +https://github.com/samstern)",
        Accept: "text/html",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    return html.trim().length > 500 ? html : null;
  } catch {
    return null;
  }
}

async function getArticleHtml(
  token: { key: string; secret: string },
  bookmarkId: number,
  url?: string,
): Promise<string> {
  try {
    return await getBookmarkText(token, bookmarkId);
  } catch (err) {
    if (url) {
      const fetched = await fetchOriginalArticle(url);
      if (fetched) return fetched;
    }
    throw err;
  }
}

export async function buildBookEpub(
  token: { key: string; secret: string },
  bookmarkId: number,
  slugFromPath: string,
  opts: BookOptions,
): Promise<{ bytes: Uint8Array; filename: string }> {
  let title = opts.title;
  let fragment = "";
  let byline: string | undefined;

  try {
    const html = await getArticleHtml(token, bookmarkId, opts.url);
    const extracted = extractArticle(html, opts.url ?? "");
    if (extracted?.content) {
      fragment = toXhtmlFragment(extracted.content, opts.url ?? "");
    }
    title = title || extracted?.title || titleFromHtml(html) || `Article ${bookmarkId}`;
    byline = extracted?.byline;
  } catch (err) {
    if (!(err instanceof InstapaperError)) throw err;
    const reason = esc(err.message);
    const link = opts.url
      ? `<p>Original article: <a href="${esc(opts.url)}">${esc(opts.url)}</a></p>`
      : "";
    fragment = `<p>The full text of this article could not be retrieved (${reason}).</p>${link}`;
    title = title ?? (slugFromPath.replace(/-\d+$/, "") || `Article ${bookmarkId}`);
  }

  const author = byline || domainAuthor(opts.url);
  const date =
    opts.timestamp && opts.timestamp > 0 ? new Date(opts.timestamp * 1000) : new Date();
  if (!fragment) {
    fragment = `<p>This article has no extractable text.</p>`;
  }
  const bytes = await buildEpub({
    id: `urn:instapaper:bookmark:${bookmarkId}`,
    title,
    author,
    language: "en",
    date,
    sourceUrl: opts.url,
    html: fragment,
  });
  const slug = slugify(title, `article-${bookmarkId}`);
  return { bytes, filename: `${slug}-${bookmarkId}.epub` };
}
