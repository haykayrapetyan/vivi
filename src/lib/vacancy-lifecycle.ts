import type { VacancyStatus } from "@/lib/db/schema";

// Vacancy lifecycle: draft → published ⇄ closed → archived (restore → draft).
// Publishing itself goes through publishVacancy (it validates content and
// builds the public slug); this map covers every other transition.
const TRANSITIONS: Record<VacancyStatus, VacancyStatus[]> = {
  draft: ["archived"],
  published: ["closed", "archived"],
  closed: ["published", "archived"],
  archived: ["draft"],
};

export function canTransition(
  from: VacancyStatus,
  to: VacancyStatus,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Statuses where the vacancy accepts candidate input (applies + interviews). */
export function isAcceptingCandidates(status: VacancyStatus): boolean {
  return status === "published";
}

/** Statuses visible on the public vacancy page (closed shows a notice). */
export function isPubliclyVisible(status: VacancyStatus): boolean {
  return status === "published" || status === "closed";
}
