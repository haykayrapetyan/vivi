import type { VacancyDetails } from "@/lib/db/schema";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { formatSalary } from "@/lib/format";

export type ParamKey =
  | "salary"
  | "workMode"
  | "location"
  | "employment"
  | "seniority";
export type ParamRow = { key: ParamKey; label: string; value: string };

/** Builds labeled parameter rows from a vacancy's structured details.
 * Salary first (most important), then format, location, employment, seniority. */
export function vacancyParamRows(
  details: VacancyDetails | null | undefined,
  t: Dictionary,
): ParamRow[] {
  if (!details) return [];
  const rows: ParamRow[] = [];

  const salary = formatSalary(details);
  if (salary) rows.push({ key: "salary", label: t.params.salary, value: salary });
  if (details.workMode && details.workMode in t.params) {
    rows.push({
      key: "workMode",
      label: t.params.workMode,
      value: t.params[details.workMode],
    });
  }
  if (details.location) {
    rows.push({ key: "location", label: t.params.location, value: details.location });
  }
  if (details.employmentType) {
    rows.push({
      key: "employment",
      label: t.params.employment,
      value: details.employmentType,
    });
  }
  if (details.seniority) {
    rows.push({ key: "seniority", label: t.params.seniority, value: details.seniority });
  }
  return rows;
}
