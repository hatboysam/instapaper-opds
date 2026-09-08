import { writeFileSync } from "node:fs";
import { extractArticle, toXhtmlFragment } from "../src/core/extract";
import { buildEpub } from "../src/core/epub";
import { navigationFeed, acquisitionFeed } from "../src/core/opds";
import { slugify } from "../src/core/slug";
import JSZip from "jszip";

const FIXTURE = `
<html><head><title>Sample</title></head><body>
<article>
<script>alert('x')</script>
<h1 style="color:red" onclick="alert('x')">Real Heading</h1>
<div>
  <p>First paragraph with <a href="/relative">a relative link</a> and <b>bold</b> and <i>italic</i>.</p>
  <blockquote>Someone said this.</blockquote>
  <p>Second paragraph &amp; entities: &mdash; done.</p>
  <p>Line one<br>line two</p>
  <span>loose inline text</span> after div unwrap
</div>
<ul><li>one</li><li>two</li></ul>
</article>
</body></html>
`;

async function main() {
  const extracted = extractArticle(FIXTURE, "https://example.com/post/1");
  if (!extracted?.content) throw new Error("readability extraction failed");
  console.log("=== extracted ===");
  console.log("title:", extracted.title, "| byline:", extracted.byline);

  const fragment = toXhtmlFragment(extracted.content, "https://example.com/post/1");
  console.log("\n=== xhtml fragment ===\n" + fragment + "\n");
  if (fragment.includes("<script") || fragment.includes("img.png") || fragment.includes("<img")) {
    throw new Error("forbidden content survived cleaning");
  }
  if (/<p>\s*<\/p>/.test(fragment)) {
    throw new Error("empty paragraph survived cleaning");
  }
  if (fragment.includes('style=') || fragment.includes('onclick')) {
    throw new Error("dangerous attributes survived cleaning");
  }
  if (!fragment.includes('href="https://example.com/relative"')) {
    throw new Error("relative link not resolved");
  }
  if (!/<br\/>/.test(fragment)) throw new Error("void elements not xhtml-serialized");
  if (!/&amp;/.test(fragment)) throw new Error("entity escaping lost");

  const dirty =
    `<base href="http://evil.example/">` +
    `<p background="http://evil.example/bg.png">x</p>` +
    `<svg onload="alert(1)"><script>alert(2)</script></svg>` +
    `<table><tr><td colspan="2" onclick="alert(3)">c</td></tr></table>`;
  const clean = toXhtmlFragment(dirty, "https://example.com/");
  if (/<base|background=|\bonload|<script|evil\.example/i.test(clean)) {
    throw new Error(`sanitizer allowlist failed: ${clean}`);
  }
  if (!clean.includes('colspan="2"')) throw new Error("allowlist stripped legit attrs");

  const slug = slugify("Hello, World! A Long Title — With Stuff", "article-1");
  if (slug !== "hello-world-a-long-title-with-stuff") {
    throw new Error(`slugify produced: ${slug}`);
  }

  const bytes = await buildEpub({
    id: "urn:instapaper:bookmark:12345",
    title: "Smoke Test Article",
    author: "example.com",
    language: "en",
    date: new Date(),
    sourceUrl: "https://example.com/post/1",
    html: fragment,
  });
  const path = "/tmp/ipx-smoke.epub";
  writeFileSync(path, bytes);
  console.log(`\nwrote ${path} (${bytes.length} bytes)`);

  const zip = await JSZip.loadAsync(bytes);
  const names = Object.keys(zip.files);
  console.log("entries:", names.join(", "));
  const mimetype = await zip.file("mimetype")!.async("string");
  if (mimetype !== "application/epub+zip") throw new Error("bad mimetype");
  if (!names.includes("META-INF/container.xml")) throw new Error("missing container.xml");
  const opfName = names.find((n) => n.endsWith(".opf"));
  if (!opfName) throw new Error("missing package document");
  const xhtmlNames = names.filter((n) => n.endsWith(".xhtml") || n.endsWith(".html"));
  if (!xhtmlNames.length) throw new Error("no chapter documents");
  let foundText = false;
  for (const n of xhtmlNames) {
    const content = await zip.file(n)!.async("string");
    if (content.includes("First paragraph")) {
      foundText = true;
      if (!content.includes("https://example.com/relative")) {
        throw new Error("relative link survived into epub");
      }
    }
  }
  if (!foundText) throw new Error("chapter text missing from epub");

  const nav = navigationFeed({
    id: "urn:test:root",
    title: "Root",
    selfUrl: "https://x.test/opds",
    entries: [
      { title: "Unread", href: "https://x.test/opds/unread?page=1", updated: new Date() },
    ],
  });
  const acq = acquisitionFeed({
    id: "urn:test:unread",
    title: "Unread",
    selfUrl: "https://x.test/opds/unread?page=1",
    nextUrl: "https://x.test/opds/unread?page=2",
    entries: [
      {
        id: "urn:instapaper:bookmark:42",
        title: "An <Article> & More",
        updated: new Date(),
        summary: "desc with <tags>",
        acquisitionHref: "https://x.test/opds/book/an-article-42.epub",
      },
    ],
  });
  console.log("\n=== nav feed ===\n" + nav);
  console.log("\n=== acquisition feed ===\n" + acq);
  if (!acq.includes("&lt;Article&gt;") || !acq.includes("&amp; More")) {
    throw new Error("feed escaping broken");
  }
  if (!nav.includes('rel="subsection"')) {
    throw new Error("nav feed missing subsection link");
  }
  console.log("\nSMOKE OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
