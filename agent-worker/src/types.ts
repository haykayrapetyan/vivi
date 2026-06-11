import type { AgentNamespace } from "agents";
import type { VacancyAgent } from "./vacancy-agent";

export interface Env {
  VacancyAgent: AgentNamespace<VacancyAgent>;
  /** Base URL of the Next.js app exposing /api/agent-gateway. */
  APP_BASE_URL: string;
  /** Shared bearer secret for both directions (app→worker, worker→app). */
  AGENT_GATEWAY_SECRET: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
}
