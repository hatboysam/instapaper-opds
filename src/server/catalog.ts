import {
  getBookmarkText,
  InstapaperBookmark,
  InstapaperError,
  listBookmarks,
} from "./instapaper";
import { extractArticle, toXhtmlFragment } from "../core/extract";
import { buildEpub } from "../core/epub";
import { slugify } from "../core/slug";
import { fetchArticleSafe } from "./safe-fetch";
import { setTextBlocked, clearTextBlocked } from "./users";
import type { BasicUser } from "./auth";

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
  return { entries: slice.map(toEntry), hasMore: all.length > page * size };
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
  user: BasicUser,
  bookmarkId: number,
  slugFromPath: string,
  opts: BookOptions,
): Promise<{ bytes: Uint8Array; filename: string }> {
  const token = { key: user.token, secret: user.tokenSecret };
  let title = opts.title;
  let fragment = "";
  let byline: string | undefined;
  let failureReason: string | null = null;

  // Always attempt get_text: the flag only records the last outcome so a
  // transient 1044 doesn't permanently degrade the account.
  try {
    const html = await getBookmarkText(token, bookmarkId);
    const extracted = tryExtract(html, opts.url);
    if (extracted) {
      fragment = extracted.fragment;
      title = title || extracted.title;
      byline = extracted.byline;
    }
    if (user.getTextBlocked) await clearTextBlocked(user.username).catch(() => {});
  } catch (err) {
    if (!(err instanceof InstapaperError)) throw err;
    failureReason = err.message;
    if (err.code === 1044) {
      await setTextBlocked(user.username).catch(() => {});
    }
  }

  if (!fragment && opts.url) {
    const fetched = await fetchArticleSafe(opts.url);
    const extracted = fetched ? tryExtract(fetched.html, opts.url) : null;
    if (extracted) {
      fragment = extracted.fragment;
      title = title || extracted.title;
      byline = extracted.byline;
      failureReason = null;
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
