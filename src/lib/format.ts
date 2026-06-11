/** Maps a currency code, symbol, or word (USD, $, dollars, …) to a display
 * symbol. Recognizes a few localized words too, so a stray non-code value
 * still resolves to a symbol instead of being shown verbatim. */
export function currencySymbol(cur?: string): string {
  if (!cur) return "";
  const c = cur.trim().toLowerCase();
  if (/\$|usd|dollar|долл/.test(c)) return "$";
  if (/€|eur|euro|евро/.test(c)) return "€";
  if (/£|gbp|pound|фунт/.test(c)) return "£";
  if (/₽|rub|рубл|руб/.test(c)) return "₽";
  if (/֏|amd|драм/.test(c)) return "֏";
  if (/₸|kzt|тенге/.test(c)) return "₸";
  if (/₴|uah|гривн/.test(c)) return "₴";
  return cur.trim().toUpperCase();
}

/** Replaces currency codes/words inside free text with their symbol, so a
 * legacy free-text salary like "7000 dollars" / "7000 долларов" renders with
 * the "$" symbol instead of a spelled-out word. */
export function symbolizeCurrencyText(text: string): string {
  return text
    .replace(/\bUSD\b|\bdollars?\b|долл[а-яё]*/gi, "$")
    .replace(/\bEUR\b|\beuros?\b|евро/gi, "€")
    .replace(/\bGBP\b|\bpounds?\b|фунт[а-яё]*/gi, "£")
    .replace(/\bRUB\b|\brubles?\b|рубл[а-яё]*|\bруб\b/gi, "₽")
    .replace(/\bAMD\b|\bdrams?\b|драм[а-яё]*/gi, "֏")
    .replace(/\s{2,}/g, " ")
    .trim();
}

type SalaryInput = {
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: "month" | "year" | "hour" | string;
  salaryRange?: string;
};

const PERIODS: Record<string, string> = {
  month: "/mo",
  year: "/yr",
  hour: "/hr",
};

/** Formats a structured salary, e.g. "3,000–4,000 $/mo". Falls back to a
 * legacy free-text `salaryRange`, or null when there is nothing to show. */
export function formatSalary(d: SalaryInput): string | null {
  const { salaryMin, salaryMax, salaryCurrency, salaryPeriod } = d;
  if (salaryMin == null && salaryMax == null) {
    const raw = d.salaryRange?.trim();
    return raw ? symbolizeCurrencyText(raw) : null;
  }
  const nf = new Intl.NumberFormat("en-US");
  const sym = currencySymbol(salaryCurrency);
  const period = salaryPeriod ? (PERIODS[salaryPeriod] ?? "") : "";

  let amount: string;
  if (salaryMin != null && salaryMax != null) {
    amount = `${nf.format(salaryMin)}–${nf.format(salaryMax)}`;
  } else if (salaryMin != null) {
    amount = `from ${nf.format(salaryMin)}`;
  } else {
    amount = `up to ${nf.format(salaryMax as number)}`;
  }
  return `${amount}${sym ? ` ${sym}` : ""}${period}`;
}

/** Seconds → "m:ss". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
