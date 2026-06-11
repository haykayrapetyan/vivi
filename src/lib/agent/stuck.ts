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
