// Worker entry. Three surfaces:
//  - POST /event   — agent events from the Next.js app (bearer secret)
//  - GET  /status  — agent presence for the app UI (bearer secret)
//  - /agents/*     — WebSocket from the recruiter's BROWSER for realtime
//                    updates, authorized by a short-lived HMAC token the app
//                    mints after its own org check.

import { getAgentByName, routeAgentRequest } from "agents";
import type { AgentEvent } from "../../src/lib/agent/gateway-types";
import { verifySocketToken } from "../../src/lib/agent/socket-token";
import type { Env } from "./types";

export { VacancyAgent } from "./vacancy-agent";

function bearerAuthorized(request: Request, env: Env): boolean {
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
      if (!bearerAuthorized(request, env)) {
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
      let result: { ok: boolean; skipped?: string };
      if (event.type === "candidate_completed") {
        result = await agent.onCandidateCompleted(event.candidateId);
      } else if (event.type === "review") {
        await agent.heartbeat();
        result = { ok: true };
      } else {
        result = await agent.onPublished();
      }
      return Response.json(result);
    }

    if (request.method === "GET" && url.pathname === "/status") {
      if (!bearerAuthorized(request, env)) {
        return new Response("Unauthorized", { status: 401 });
      }
      const vacancyId = url.searchParams.get("vacancyId");
      if (!vacancyId) return new Response("Bad request", { status: 400 });
      const agent = await getAgentByName(env.VacancyAgent, vacancyId);
      return Response.json(await agent.getStatus());
    }

    // Browser WebSocket: /agents/vacancy-agent/:vacancyId?token=…
    // The token is scoped to ONE vacancy — verify it against the path name.
    if (url.pathname.startsWith("/agents/")) {
      const segments = url.pathname.split("/").filter(Boolean);
      const instanceName = segments[2] ? decodeURIComponent(segments[2]) : "";
      const ok =
        Boolean(env.AGENT_GATEWAY_SECRET) &&
        (await verifySocketToken(
          env.AGENT_GATEWAY_SECRET,
          instanceName,
          url.searchParams.get("token"),
        ));
      if (!ok) return new Response("Unauthorized", { status: 401 });

      const response = await routeAgentRequest(request, env);
      if (response) return response;
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
