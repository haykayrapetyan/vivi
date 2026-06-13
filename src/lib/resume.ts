import "server-only";
import { readObject } from "@/lib/storage";
import { safeFetch } from "@/lib/safe-fetch";
import { stripHtml } from "@/lib/html";

const MAX_CHARS = 6000;

/** Extracts plain text from an uploaded résumé file (best-effort, by extension). */
async function textFromFile(key: string): Promise<string | null> {
  try {
    const { body } = await readObject(key);
    const ext = key.split(".").pop()?.toLowerCase() ?? "";
    if (ext === "txt") {
      return body.toString("utf8").trim() || null;
    }
    if (ext === "pdf") {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(body));
      const { text } = await extractText(pdf, { mergePages: true });
      const joined = Array.isArray(text) ? text.join(" ") : text;
      return joined.trim() || null;
    }
    if (ext === "docx") {
      const mammoth = (await import("mammoth")).default;
      const { value } = await mammoth.extractRawText({ buffer: body });
      return value.trim() || null;
    }
    // Legacy .doc (binary) and anything else: not worth a parser — skip.
    return null;
  } catch (e) {
    console.error("[resume] file extraction failed:", e);
    return null;
  }
}

/** Fetches a pasted résumé link and strips it to readable text (SSRF-guarded). */
async function textFromUrl(url: string): Promise<string | null> {
  try {
    const res = await safeFetch(url, {
      headers: { "user-agent": "ViviBot/1.0 (+https://vivi.app)" },
    });
    if (!res?.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/pdf")) {
      const buf = Buffer.from(await res.arrayBuffer());
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const { text } = await extractText(pdf, { mergePages: true });
      const joined = Array.isArray(text) ? text.join(" ") : text;
      return joined.trim() || null;
    }
    if (!/text|html/.test(ct)) return null;
    return stripHtml(await res.text()) || null;
  } catch (e) {
    console.error("[resume] url fetch failed:", e);
    return null;
  }
}

/**
 * Gathers résumé text for a candidate from their uploaded file and/or pasted
 * link. Best-effort — returns null when nothing usable is available (no résumé,
 * a link that blocks scraping like LinkedIn, an unparseable file). The result is
 * candidate-supplied and MUST be treated as untrusted when fed to a model.
 */
export async function getResumeText(cand: {
  resumeKey: string | null;
  resumeUrl: string | null;
}): Promise<string | null> {
  const parts: string[] = [];
  if (cand.resumeKey) {
    const t = await textFromFile(cand.resumeKey);
    if (t) parts.push(t);
  }
  if (cand.resumeUrl) {
    const t = await textFromUrl(cand.resumeUrl);
    if (t) parts.push(t);
  }
  if (parts.length === 0) return null;
  return parts.join("\n\n").slice(0, MAX_CHARS);
}
