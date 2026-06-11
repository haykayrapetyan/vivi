import { customAlphabet } from "nanoid";

const shortId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 6);

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "vacancy";
}

export function buildPublicSlug(title: string): string {
  return `${slugify(title)}-${shortId()}`;
}
