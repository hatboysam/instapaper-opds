import slugifyBase from "slugify";

export function slugify(title: string, fallback: string): string {
  const slug = slugifyBase(title, { lower: true, strict: true, trim: true }).slice(0, 60).replace(/-+$/g, "");
  return slug || fallback;
}
