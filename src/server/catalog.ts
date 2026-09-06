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

function domainAuthor(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

async function fetchOriginalArticle(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html" },
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

function tryExtract(
  html: string,
  baseUrl?: string,
): { fragment: string; title?: string; byline?: string } | null {
  const extracted = extractArticle(html, baseUrl ?? "");
  if (!extracted?.content) return null;
  const fragment = toXhtmlFragment(extracted.content, baseUrl ?? "");
  if (!fragment) return null;
  return { fragment, title: extracted.title, byline: extracted.byline };
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
  let failureReason: string | null = null;

  const useExtracted = (
    result: { fragment: string; title?: string; byline?: string } | null,
  ): boolean => {
    if (!result) return false;
    fragment = result.fragment;
    title = title || result.title;
    byline = result.byline;
    return true;
  };

  try {
    const html = await getBookmarkText(token, bookmarkId);
    if (!useExtracted(tryExtract(html, opts.url)) && opts.url) {
      const fetched = await fetchOriginalArticle(opts.url);
      if (fetched) useExtracted(tryExtract(fetched, opts.url));
    }
  } catch (err) {
    if (!(err instanceof InstapaperError)) throw err;
    failureReason = err.message;
    if (opts.url) {
      const fetched = await fetchOriginalArticle(opts.url);
      if (fetched && useExtracted(tryExtract(fetched, opts.url))) {
        failureReason = null;
      }
    }
  }

  const date =
    opts.timestamp && opts.timestamp > 0 ? new Date(opts.timestamp * 1000) : new Date();

  if (!fragment) {
    const reason = failureReason ? ` (${esc(failureReason)})` : "";
    const link = opts.url
      ? `<p>Original article: <a href="${esc(opts.url)}">${esc(opts.url)}</a></p>`
      : "";
    fragment = `<p>The full text of this article could not be retrieved${reason}.</p>${link}`;
  }
  title = title ?? (slugFromPath.replace(/-\d+$/, "") || `Article ${bookmarkId}`);

  const author = byline || domainAuthor(opts.url);
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
