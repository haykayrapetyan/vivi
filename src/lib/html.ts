/**
 * Strips HTML to readable plain text: drops <script>/<style> bodies, removes all
 * tags, decodes the common named entities and collapses whitespace, then caps the
 * length. Pure (no server-only) so it's safe to import anywhere.
 */
export function stripHtml(html: string, maxChars = 6000): string {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, maxChars);
}
