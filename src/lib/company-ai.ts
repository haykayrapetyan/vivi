import "server-only";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

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

function isBlockedHost(hostname: string): boolean {
  return (
    /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.)/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    hostname === "::1" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  );
}

async function fetchWebsiteText(url: string): Promise<string | null> {
  try {
    const parsed = new URL(url);
    if (isBlockedHost(parsed.hostname)) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "ViviBot/1.0 (+https://vivi.app)" },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return null;

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

  const prompt = `Составь краткое описание компании для использования в вакансиях. Пиши на русском, по-деловому, без воды.

Название: ${name}
${url ? `Сайт: ${url}` : ""}
${
  siteText
    ? `Фрагмент содержимого сайта:\n${siteText}`
    : "Содержимое сайта недоступно — опиши обобщённо по названию, без выдуманных фактов."
}

Сделай 2–4 коротких абзаца в Markdown: чем занимается компания, продукт/услуги, ценности и культура, чем привлекательна для кандидатов. Не выдумывай конкретные цифры, имена клиентов или факты, которых нет в источнике.`;

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
