import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getOwnedVacancy } from "@/lib/data";
import { mintSocketToken } from "@/lib/agent/socket-token";

// Hands the browser what it needs to open a realtime WebSocket to this
// vacancy's agent (Durable Object): the worker URL and a short-lived token.
// The org check happens HERE; the worker only verifies the token.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const owned = await getOwnedVacancy(id, session.user.id);
  if (!owned) return new Response("Not found", { status: 404 });

  const base = process.env.AGENT_WORKER_URL;
  const secret = process.env.AGENT_GATEWAY_SECRET;
  if (!base || !secret) {
    return NextResponse.json({ enabled: false });
  }

  const token = await mintSocketToken(secret, id);
  return NextResponse.json({
    enabled: true,
    url: `${base.replace(/\/$/, "")}/agents/vacancy-agent/${encodeURIComponent(id)}`,
    token,
  });
}
