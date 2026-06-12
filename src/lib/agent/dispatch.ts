import "server-only";
import type { AgentEvent } from "./gateway-types";

// The agent's "body" is a Cloudflare Durable Object (agent-worker/). The Next
// app wakes it by POSTing events to the worker; the worker thinks (LLM) and
// reaches back through /api/agent-gateway for data and actions.
//
// AGENT_WORKER_URL e.g. http://localhost:8787 (wrangler dev) or the deployed
// workers.dev URL. AGENT_GATEWAY_SECRET authenticates BOTH directions.

export type AgentStatus = {
  lastReviewAt: string | null;
  screenedCount: number;
  nextHeartbeatAt: string | null;
};

/** Presence of the vacancy's agent (Durable Object state). Null when the
 * worker is not configured or unreachable — the UI just hides the line. */
export async function fetchAgentStatus(
  vacancyId: string,
): Promise<AgentStatus | null> {
  const base = process.env.AGENT_WORKER_URL;
  const secret = process.env.AGENT_GATEWAY_SECRET;
  if (!base || !secret) return null;
  try {
    const res = await fetch(
      `${base.replace(/\/$/, "")}/status?vacancyId=${encodeURIComponent(vacancyId)}`,
      {
        headers: { authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(1500),
      },
    );
    if (!res.ok) return null;
    return (await res.json()) as AgentStatus;
  } catch {
    return null;
  }
}

/**
 * Sends an event to the vacancy's agent. Returns false when the worker is
 * not configured or unreachable so callers can fall back to an inline run.
 */
export async function dispatchAgentEvent(event: AgentEvent): Promise<boolean> {
  const base = process.env.AGENT_WORKER_URL;
  const secret = process.env.AGENT_GATEWAY_SECRET;
  if (!base || !secret) return false;

  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/event`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      console.warn(`[agent] worker responded ${res.status} for ${event.type}`);
      return false;
    }
    return true;
  } catch (e) {
    console.warn(
      "[agent] worker unreachable, falling back to inline run:",
      e instanceof Error ? e.message : e,
    );
    return false;
  }
}
