// Idempotency keys for agent_task rows ("this unit of work happened").

/** Screening of one candidate after they complete the interview. */
export function screenKey(candidateId: string): string {
  return `screen:${candidateId}`;
}

/** The agent's one-time introduction posted when a vacancy is first published. */
export function kickoffKey(vacancyId: string): string {
  return `kickoff:${vacancyId}`;
}
