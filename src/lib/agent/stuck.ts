// Pure pool-health helpers for the agent's periodic review.

export const STUCK_THRESHOLD_HOURS = 48;

/**
 * Candidates who applied but never finished the interview within the
 * threshold — the agent flags them in its periodic review so the recruiter
 * can nudge (or the agent will, in a later autonomy phase).
 */
export function findStuckCandidates<
  T extends { status: string; completedAt: Date | null; createdAt: Date },
>(candidates: T[], now: Date, thresholdHours = STUCK_THRESHOLD_HOURS): T[] {
  const cutoff = now.getTime() - thresholdHours * 3_600_000;
  return candidates.filter(
    (c) =>
      !c.completedAt &&
      (c.status === "applied" || c.status === "interviewing") &&
      c.createdAt.getTime() <= cutoff,
  );
}

/** Whole days a candidate has been waiting, for human-readable prompts. */
export function daysWaiting(createdAt: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / 86_400_000));
}

/**
 * Catch-up sweep: completed candidates whose screening never happened (lost
 * event, worker downtime). `screenKeyOf` keeps this module free of imports;
 * `limit` bounds LLM cost per heartbeat.
 */
export function pickUnscreened<
  T extends { id: string; completedAt: Date | string | null },
>(
  pool: T[],
  doneTaskKeys: string[],
  screenKeyOf: (candidateId: string) => string,
  limit = 3,
): T[] {
  const done = new Set(doneTaskKeys);
  return pool
    .filter((c) => c.completedAt && !done.has(screenKeyOf(c.id)))
    .slice(0, limit);
}
