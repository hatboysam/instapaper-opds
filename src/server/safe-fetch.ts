import { Agent, buildConnector, fetch as undiciFetch } from "undici";
import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";

const MAX_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 15000;

const BLOCKED_V4: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["100.64.0.0", 10],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

const BLOCKED_V6: [string, number][] = [
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["2001:db8::", 32],
];

function isPublicIp(ip: string): boolean {
  try {
    const addr = ipaddr.parse(ip);
    if (addr.kind() === "ipv6" && addr.range() === "ipv4Mapped") {
      return isPublicIp((addr as ipaddr.IPv6).toIPv4Address().toString());
    }
    const blocked = addr.kind() === "ipv4" ? BLOCKED_V4 : BLOCKED_V6;
    return !blocked.some(([base, bits]) => addr.match(ipaddr.parse(base), bits));
  } catch {
    return false;
  }
}

const connector = buildConnector({ timeout: TIMEOUT_MS });

const agent = new Agent({
  connect: (opts, cb) => {
    validateAndPin(opts)
      .then((pinned) => connector(pinned, cb))
      .catch((err: Error) => cb(err, null));
  },
});

function isValidIp(value: string): boolean {
  try {
    ipaddr.parse(value);
    return true;
  } catch {
    return false;
  }
}

async function validateAndPin(
  opts: buildConnector.Options,
): Promise<buildConnector.Options> {
  const host = opts.hostname.trim().toLowerCase();
  let addrs: string[];
  if (isValidIp(host)) {
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
  if (!res.body) return Buffer.alloc(0);
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
        throw new Error("Response too large");
      }
      chunks.push(Buffer.from(value));
    }
  }
  return Buffer.concat(chunks);
}

const REDIRECT_STATUSES = [301, 302, 303, 307, 308];

function isAllowedUrl(url: URL): boolean {
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  // Pin to web ports only — no reaching internal services on odd ports.
  if (url.port !== "" && url.port !== "80" && url.port !== "443") return false;
  return true;
}

const BLOCKED_CONTENT_TYPES = /^(image|audio|video)\/|application\/(pdf|octet-stream|zip|epub\+zip)/i;

export async function fetchArticleSafe(
  rawUrl: string,
): Promise<{ html: string } | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (!isAllowedUrl(url)) return null;

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
        if (!isAllowedUrl(next)) return null;
        url = next;
      } catch {
        return null;
      }
      continue;
    }
    if (!res.ok || !res.body) return null;
    // Fail open to the capped reader below on missing/garbled headers.
    if (Number(res.headers.get("content-length")) > MAX_BYTES) return null;
    if (BLOCKED_CONTENT_TYPES.test(res.headers.get("content-type") ?? "")) return null;
    try {
      const html = (await readCapped(res, MAX_BYTES)).toString("utf8");      return html.trim().length > 500 ? { html } : null;
    } catch {
      return null;
    }
  }
  return null;
}
