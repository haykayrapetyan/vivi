import "server-only";
import { safeFetch } from "@/lib/safe-fetch";
import { saveObject } from "@/lib/storage";

const UA = { "user-agent": "ViviBot/1.0 (+https://vivi.app)" };
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/** R2 key for a company logo. */
export const logoKey = (organizationId: string) => `logos/${organizationId}`;

/** App-relative URL the <img> tags use; the route redirects to a signed R2 URL.
 * The version query busts caches after re-upload. */
export const logoUrl = (organizationId: string) =>
  `/api/media/logo/${organizationId}?v=${Date.now()}`;

/** Picks a likely logo URL out of a page's HTML (apple-touch-icon is usually
 * the largest clean mark; generic icons and favicon.ico are fallbacks). */
export function findLogoUrl(html: string, baseUrl: string): string | null {
  const head = html.slice(0, 200_000);
  const links = head.match(/<link\s[^>]*>/gi) ?? [];

  const hrefOf = (tag: string) =>
    tag.match(/href\s*=\s*["']([^"']+)["']/i)?.[1] ?? null;
  const pick = (relPattern: RegExp) => {
    for (const tag of links) {
      const rel = tag.match(/rel\s*=\s*["']([^"']+)["']/i)?.[1];
      if (rel && relPattern.test(rel)) {
        const href = hrefOf(tag);
        if (href) return href;
      }
    }
    return null;
  };

  const candidate =
    pick(/apple-touch-icon/i) ?? pick(/(^|\s)(icon|shortcut icon)(\s|$)/i);

  try {
    if (candidate) return new URL(candidate, baseUrl).toString();
    return new URL("/favicon.ico", baseUrl).toString();
  } catch {
    return null;
  }
}

/**
 * Best-effort: discovers the company logo on its website, downloads it and
 * stores it in R2. Returns the app-relative logo URL, or null when nothing
 * usable was found. Never throws.
 */
export async function fetchAndStoreLogo(
  organizationId: string,
  websiteUrl: string,
): Promise<string | null> {
  try {
    const page = await safeFetch(websiteUrl, { headers: UA });
    if (!page?.ok) return null;
    const discovered = findLogoUrl(await page.text(), page.url || websiteUrl);
    if (!discovered) return null;

    const img = await safeFetch(discovered, { headers: UA });
    if (!img?.ok) return null;
    const type = img.headers.get("content-type")?.split(";")[0].trim() ?? "";
    if (!type.startsWith("image/")) return null;

    const buf = Buffer.from(await img.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_LOGO_BYTES) return null;

    await saveObject(logoKey(organizationId), buf, type);
    return logoUrl(organizationId);
  } catch (e) {
    console.error("[logo] discovery failed:", e);
    return null;
  }
}
