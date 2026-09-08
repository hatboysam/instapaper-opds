import { Agent, buildConnector, fetch as undiciFetch } from "undici";
import { lookup } from "node:dns/promises";
import net from "node:net";

const MAX_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 15000;

export class BlockedHostError extends Error {
  constructor() {
    super("Blocked host");
    this.name = "BlockedHostError";
  }
}

function isPublicIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 192 && (b === 0 || b === 2)) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a >= 224) return false;
  return true;
}

function isPublicIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isPublicIpv4(ip);
  const lower = ip.toLowerCase();
  if (lower.startsWith("::ffff:")) return isPublicIp(lower.slice(7));
  if (lower === "::" || lower === "::1") return false;
  if (/^fe[89ab]/.test(lower)) return false;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return false;
  if (lower.startsWith("ff")) return false;
  if (lower.startsWith("2001:db8")) return false;
  return true;
}

const connector = buildConnector({ timeout: TIMEOUT_MS });

const agent = new Agent({
  connect: (opts, cb) => {
    validateAndPin(opts)
      .then((pinned) => connector(pinned, cb))
      .catch((err: Error) => cb(err, null));
  },
});

async function validateAndPin(
  opts: buildConnector.Options,
): Promise<buildConnector.Options> {
  const host = opts.hostname.trim().toLowerCase();
  let addrs: string[];
  if (net.isIPv4(host) || net.isIPv6(host)) {
    addrs = [host];
  } else {
    const resolved = await lookup(host, { all: true, verbatim: true });
    addrs = resolved.map((r) => r.address);
    if (!addrs.length) throw new Error("DNS resolution failed");
  }
  for (const ip of addrs) {
    if (!isPublicIp(ip)) throw new Error("Blocked private address");
  }
  const pinned: buildConnector.Options = {
    ...opts,
    hostname: addrs[0],
    host: addrs[0],
  };
  if (opts.protocol === "https:") pinned.servername = host;
  return pinned;
}

async function readCapped(
  res: {
    body: {
      getReader(): {
        read(): Promise<{ done: boolean; value?: Uint8Array }>;
        cancel(): Promise<void>;
      };
    } | null;
  },
  cap: number,
): Promise<Buffer> {
  if (!res.body) throw new BlockedHostError();
  const reader = res.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > cap) {
        await reader.cancel();
        throw new BlockedHostError();
      }
      chunks.push(Buffer.from(value));
    }
  }
  return Buffer.concat(chunks);
}

const REDIRECT_STATUSES = [301, 302, 303, 307, 308];

export async function fetchArticleSafe(
  rawUrl: string,
): Promise<{ html: string } | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let res: Awaited<ReturnType<typeof undiciFetch>>;
    try {
      res = await undiciFetch(url, {
        dispatcher: agent,
        redirect: "manual",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      return null;
    }
    if (REDIRECT_STATUSES.includes(res.status)) {
      const location = res.headers.get("location");
      if (!location) return null;
      try {
        const next = new URL(location, url);
        if (next.protocol !== "https:" && next.protocol !== "http:") return null;
        url = next;
      } catch {
        return null;
      }
      continue;
    }
    if (!res.ok || !res.body) return null;
    try {
      const html = (await readCapped(res, MAX_BYTES)).toString("utf8");      return html.trim().length > 500 ? { html } : null;
    } catch {
      return null;
    }
  }
  return null;
}
