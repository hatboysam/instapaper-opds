import OAuth from "oauth-1.0a";
import crypto from "node:crypto";

const API_BASE = "https://www.instapaper.com/api/1";

export interface InstapaperBookmark {
  bookmark_id: number;
  url: string;
  title: string;
  description?: string;
  hash?: string;
  progress?: number;
  starred?: string | number;
  time?: number;
  progress_timestamp?: number;
}

export interface BookmarksListResponse {
  user?: { user_id: number; username: string };
  bookmarks: InstapaperBookmark[];
  delete_ids?: string[];
}

export class InstapaperError extends Error {
  code?: number;
  constructor(message: string, code?: number) {
    super(message);
    this.name = "InstapaperError";
    this.code = code;
  }
}

function oauthHeader(
  url: string,
  data: Record<string, string>,
  token?: { key: string; secret: string },
): string {
  const consumerKey = process.env.INSTAPAPER_CONSUMER_KEY;
  const consumerSecret = process.env.INSTAPAPER_CONSUMER_SECRET;
  if (!consumerKey || !consumerSecret) {
    throw new InstapaperError("Instapaper consumer credentials not configured");
  }
  const oauth = new OAuth({
    consumer: { key: consumerKey, secret: consumerSecret },
    signature_method: "HMAC-SHA1",
    hash_function: (base, key) =>
      crypto.createHmac("sha1", key).update(base).digest("base64"),
  });
  const header = oauth.toHeader(
    oauth.authorize({ url, method: "POST", data }, token),
  ) as { Authorization: string };
  return header.Authorization;
}

async function post(
  path: string,
  data: Record<string, string>,
  token?: { key: string; secret: string },
): Promise<Response> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: oauthHeader(url, data, token),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(data).toString(),
    signal: AbortSignal.timeout(10000),
  });
  return res;
}

async function parseError(res: Response): Promise<InstapaperError> {
  let code: number | undefined;
  let message = `Instapaper API error (HTTP ${res.status})`;
  try {
    const text = await res.text();
    try {
      const json = JSON.parse(text) as { error?: number };
      if (typeof json.error === "number") code = json.error;
    } catch {
      const params = new URLSearchParams(text);
      const problem = params.get("oauth_problem");
      if (problem) message = `Instapaper auth error: ${problem}`;
    }
    if (code) message = `Instapaper API error ${code}`;
  } catch {
    /* ignore */
  }
  return new InstapaperError(message, code);
}

export async function exchangeXAuthToken(
  username: string,
  password: string,
): Promise<{ token: string; tokenSecret: string; userId?: number }> {
  const res = await post("/oauth/access_token", {
    x_auth_username: username,
    x_auth_password: password,
    x_auth_mode: "client_auth",
  });
  if (!res.ok) throw await parseError(res);
  const params = new URLSearchParams(await res.text());
  const token = params.get("oauth_token");
  const tokenSecret = params.get("oauth_token_secret");
  if (!token || !tokenSecret) {
    throw new InstapaperError("Instapaper did not return an access token");
  }
  const userIdRaw = params.get("x_auth_user_id");
  return {
    token,
    tokenSecret,
    userId: userIdRaw ? Number(userIdRaw) : undefined,
  };
}

export interface ListOptions {
  folderId?: "unread" | "starred" | "archive";
  limit?: number;
  have?: string[];
}

function parseListResponse(json: unknown): BookmarksListResponse {
  if (Array.isArray(json)) {
    const bookmarks: InstapaperBookmark[] = [];
    const deleteIds: string[] = [];
    let user: BookmarksListResponse["user"];
    for (const el of json) {
      if (!el || typeof el !== "object") continue;
      const e = el as Record<string, unknown>;
      switch (e.type) {
        case "bookmark":
          bookmarks.push(e as unknown as InstapaperBookmark);
          break;
        case "user":
          user = { user_id: Number(e.user_id), username: String(e.username) };
          break;
        case "deleted":
          deleteIds.push(String(e.bookmark_id));
          break;
      }
    }
    return { user, bookmarks, delete_ids: deleteIds };
  }
  return json as BookmarksListResponse;
}

export async function listBookmarks(
  token: { key: string; secret: string },
  opts: ListOptions = {},
): Promise<BookmarksListResponse> {
  const data: Record<string, string> = {};
  if (opts.folderId) data.folder_id = opts.folderId;
  if (opts.limit) data.limit = String(opts.limit);
  if (opts.have?.length) data.have = opts.have.join(",");
  const res = await post("/bookmarks/list", data, token);
  if (!res.ok) throw await parseError(res);
  return parseListResponse(await res.json());
}

export async function getBookmarkText(
  token: { key: string; secret: string },
  bookmarkId: number,
): Promise<string> {
  const data: Record<string, string> = { bookmark_id: String(bookmarkId) };
  const res = await post("/bookmarks/get_text", data, token);
  if (!res.ok) throw await parseError(res);
  return res.text();
}
