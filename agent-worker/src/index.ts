// Worker entry: receives agent events from the Next.js app and routes them to
// the right VacancyAgent instance (one Durable Object per vacancy).

import { getAgentByName } from "agents";
import type { AgentEvent } from "../../src/lib/agent/gateway-types";
import type { Env } from "./types";

export { VacancyAgent } from "./vacancy-agent";

function authorized(request: Request, env: Env): boolean {
  if (!env.AGENT_GATEWAY_SECRET) return false;
  return (
    request.headers.get("authorization") ===
    `Bearer ${env.AGENT_GATEWAY_SECRET}`
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "vivi-agent" });
    }

    if (request.method === "POST" && url.pathname === "/event") {
      if (!authorized(request, env)) {
        return new Response("Unauthorized", { status: 401 });
      }

      let event: AgentEvent;
      try {
        event = (await request.json()) as AgentEvent;
      } catch {
        return new Response("Bad request", { status: 400 });
      }
      if (!event?.vacancyId || !event?.type) {
        return new Response("Bad request", { status: 400 });
      }

      const agent = await getAgentByName(env.VacancyAgent, event.vacancyId);
      const result =
        event.type === "candidate_completed"
          ? await agent.onCandidateCompleted(event.candidateId)
          : await agent.onPublished();
      return Response.json(result);
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
