import epubBase, { type Chapter, type Options } from "epub-gen-memory";

export interface EpubInput {
  id: string;
  title: string;
  author?: string;
  language?: string;
  date: Date;
  sourceUrl?: string;
  html: string;
}

const options: Pick<Options, "version" | "prependChapterTitles"> = {
  version: 3,
  prependChapterTitles: true,
};

export async function buildEpub(input: EpubInput): Promise<Uint8Array> {
  const chapter: Chapter = {
    title: input.title,
    author: input.author,
    content: input.html,
    url: input.sourceUrl,
  };
  const buffer = await epubBase(
    {
      ...options,
      title: input.title,
      author: input.author ?? "anonymous",
      lang: input.language ?? "en",
      date: input.date.toISOString(),
    },
    [chapter],
  );
  return new Uint8Array(buffer);
}
