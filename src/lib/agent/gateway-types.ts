// Wire types shared between the Next.js gateway (/api/agent-gateway) and the
// Cloudflare agent worker (agent-worker/). Pure types — keep this file free
// of imports so both bundlers can consume it.

/** Event the Next app sends to the worker to wake a vacancy's agent. */
export type AgentEvent =
  | { type: "candidate_completed"; vacancyId: string; candidateId: string }
  | { type: "published"; vacancyId: string };

export type PoolCandidate = {
  id: string;
  name: string;
  status: string;
  aiScore: number | null;
  rating: number | null;
  appliedAt: string; // ISO
  completedAt: string | null; // ISO
};

/** Everything the agent needs to think about a vacancy, in one fetch. */
export type VacancyContext = {
  vacancyId: string;
  title: string;
  status: string;
  companyName: string | null;
  companyDescriptionMd: string | null;
  /** Standing instructions the recruiter gave the agent. */
  instructions: string | null;
  questions: string[];
  pool: PoolCandidate[];
};

export type CandidateDetail = {
  id: string;
  name: string;
  status: string;
  aiScore: number | null;
  aiEvaluation: {
    summary: string;
    strengths: string[];
    concerns: string[];
    recommendation: string;
  } | null;
  answers: { question: string; transcript: string | null }[];
};

export type NotifyRequest = {
  candidateName: string;
  aiScore: number | null;
  /** agent = "review posted in chat" email; completed = legacy notification. */
  kind: "agent" | "completed";
};
