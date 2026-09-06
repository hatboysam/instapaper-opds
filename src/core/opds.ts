export interface OpdsNavEntry {
  title: string;
  href: string;
  summary?: string;
  updated: Date;
}

export interface OpdsAcqEntry {
  id: string;
  title: string;
  updated: Date;
  author?: string;
  summary?: string;
  acquisitionHref: string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function iso(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

const ATOM = "http://www.w3.org/2005/Atom";
const OPDS = "http://opds-spec.org/2010/catalog";
const DC = "http://purl.org/dc/elements/1.1/";

export function navigationFeed(opts: {
  id: string;
  title: string;
  selfUrl: string;
  entries: OpdsNavEntry[];
}): string {
  const entries = opts.entries
    .map(
      (e) => `  <entry>
    <id>${esc(e.href)}</id>
    <title>${esc(e.title)}</title>
    <updated>${iso(e.updated)}</updated>
${e.summary ? `    <summary type="text">${esc(e.summary)}</summary>\n` : ""}    <link rel="subsection" type="application/atom+xml;profile=opds-catalog;kind=acquisition" href="${esc(e.href)}"/>
  </entry>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="${ATOM}" xmlns:opds="${OPDS}" xmlns:dc="${DC}">
  <id>${esc(opts.id)}</id>
  <title>${esc(opts.title)}</title>
  <updated>${iso(new Date())}</updated>
  <link rel="self" type="application/atom+xml;profile=opds-catalog;kind=navigation" href="${esc(opts.selfUrl)}"/>
${entries}
</feed>`;
}

export function acquisitionFeed(opts: {
  id: string;
  title: string;
  selfUrl: string;
  entries: OpdsAcqEntry[];
  nextUrl?: string;
}): string {
  const entries = opts.entries
    .map((e) => {
      const author = e.author
        ? `    <author><name>${esc(e.author)}</name></author>\n`
        : "";
      const summary = e.summary
        ? `    <summary type="text">${esc(e.summary)}</summary>\n`
        : "";
      return `  <entry>
    <id>${esc(e.id)}</id>
    <title>${esc(e.title)}</title>
    <updated>${iso(e.updated)}</updated>
${author}${summary}    <link rel="http://opds-spec.org/acquisition" type="application/epub+zip" href="${esc(e.acquisitionHref)}"/>
  </entry>`;
    })
    .join("\n");
  const next = opts.nextUrl
    ? `  <link rel="next" type="application/atom+xml;profile=opds-catalog;kind=acquisition" href="${esc(opts.nextUrl)}"/>\n`
    : "";
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="${ATOM}" xmlns:opds="${OPDS}" xmlns:dc="${DC}">
  <id>${esc(opts.id)}</id>
  <title>${esc(opts.title)}</title>
  <updated>${iso(new Date())}</updated>
  <link rel="self" type="application/atom+xml;profile=opds-catalog;kind=acquisition" href="${esc(opts.selfUrl)}"/>
${next}${entries}
</feed>`;
}
