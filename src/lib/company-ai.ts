import "server-only";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { safeFetch } from "@/lib/safe-fetch";

function hasOpenAI() {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** Normalizes a user-entered website to an http(s) URL, or null if invalid. */
export function normalizeUrl(input: string): string | null {
  let u = input.trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    const url = new URL(u);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function fetchWebsiteText(url: string): Promise<string | null> {
  try {
    // safeFetch blocks private/internal destinations and re-validates every
    // redirect hop (SSRF guard).
    const res = await safeFetch(url, {
      headers: { "user-agent": "ViviBot/1.0 (+https://vivi.app)" },
    });
    if (!res?.ok) return null;

    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, 6000) || null;
  } catch {
    return null;
  }
}

/**
 * Generates a company description (Markdown) for use in vacancies, studying the
 * website when provided. Best-effort: returns null without an OpenAI key or on
 * failure. Does not invent concrete facts not present in the source.
 */
export async function generateCompanyDescription(
  name: string,
  website: string | null,
): Promise<string | null> {
  if (!hasOpenAI()) return null;
  const url = website ? normalizeUrl(website) : null;
  const siteText = url ? await fetchWebsiteText(url) : null;

  const prompt = `Write a concise company description for use in job postings. Write in English, professional, no fluff.

Name: ${name}
${url ? `Website: ${url}` : ""}
${
  siteText
    ? `Website content excerpt:\n${siteText}`
    : "Website content is unavailable — describe it generally from the name, without inventing facts."
}

Write 2–4 short Markdown paragraphs: what the company does, its product/services, values and culture, and why it's attractive to candidates. Don't invent specific numbers, client names, or facts not present in the source.`;

  try {
    const { text } = await generateText({
      model: openai(process.env.OPENAI_MODEL ?? "gpt-4o"),
      prompt,
    });
    return text.trim() || null;
  } catch (e) {
    console.error("[company-ai] generation failed:", e);
    return null;
  }
}
