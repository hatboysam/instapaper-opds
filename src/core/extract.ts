import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

export interface Extracted {
  title?: string;
  byline?: string;
  content: string;
}

export function extractArticle(html: string, baseUrl: string): Extracted | null {
  try {
    const { document } = parseHTML(html);
    const article = new Readability(document as unknown as Document).parse();
    if (!article?.content) return null;
    return {
      title: article.title || undefined,
      byline: article.byline || undefined,
      content: article.content,
    };
  } catch {
    return null;
  }
}

function unwrap(el: Element): void {
  try {
    el.replaceWith(...el.childNodes);
  } catch {
    el.remove();
  }
}

export function toXhtmlFragment(html: string, baseUrl: string): string {
  try {
    const { document } = parseHTML(`<html><body>${html}</body></html>`);
    document
      .querySelectorAll(
        "script, style, img, picture, source, iframe, embed, object, form, input, button, select, textarea, video, audio, nav, aside",
      )
      .forEach((el) => el.remove());
    document.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href") ?? "";
      if (!href || href.startsWith("#") || href.toLowerCase().startsWith("javascript:")) {
        unwrap(a);
        return;
      }
      try {
        a.setAttribute("href", new URL(href, baseUrl || undefined).toString());
      } catch {
        unwrap(a);
      }
    });
    document.querySelectorAll("*").forEach((el) => {
      let names: string[] = [];
      try {
        names = Array.from(el.attributes ?? []).map((a) => a.name);
      } catch {
        return;
      }
      for (const name of names) {
        if (name === "style" || name.startsWith("on")) {
          try {
            el.removeAttribute(name);
          } catch {
            /* ignore */
          }
        }
      }
    });
    document.querySelectorAll("p, h1, h2, h3, h4, h5, h6, blockquote").forEach((el) => {
      if (!el.textContent?.trim()) el.remove();
    });
    let out = document.body?.innerHTML ?? "";
    out = out.replace(/<(br|hr|col|wbr)\b([^>]*?)\s*\/?>/g, "<$1$2/>");
    return out.trim();
  } catch {
    return "";
  }
}
