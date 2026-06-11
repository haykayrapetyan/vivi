import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  candidate,
  interviewAnswer,
  interviewQuestion,
} from "@/lib/db/schema";
import { getOrganization, getVacancyById } from "@/lib/data";
import { evaluateCandidate } from "@/lib/ai-eval";
import {
  sendAgentReviewEmail,
  sendInterviewCompletedEmail,
} from "@/lib/email";
import { user, vacancy } from "@/lib/db/schema";
import { ensureVacancyAgent, postAgentMessage } from "@/lib/agent/store";
import type {
  CandidateDetail,
  NotifyRequest,
  VacancyContext,
} from "@/lib/agent/gateway-types";

// Internal API for the Cloudflare agent worker (agent-worker/): the agent's
// "hands". All data stays behind this gateway — the worker never talks to
// Postgres/R2/Resend directly. Auth: shared bearer secret, both directions.

export const maxDuration = 300; // evaluate transcribes video answers

function authorized(req: Request): boolean {
  const secret = process.env.AGENT_GATEWAY_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 });
  const { path } = await params;

  // GET vacancy/:id/context
  if (path.length === 3 && path[0] === "vacancy" && path[2] === "context") {
    return getVacancyContext(path[1]);
  }
  // GET vacancy/:id/candidate/:candidateId
  if (path.length === 4 && path[0] === "vacancy" && path[2] === "candidate") {
    return getCandidateDetail(path[1], path[3]);
  }
  return new Response("Not found", { status: 404 });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 });
  const { path } = await params;

  // POST vacancy/:id/message {content}
  if (path.length === 3 && path[0] === "vacancy" && path[2] === "message") {
    const { content } = (await req.json()) as { content?: string };
    if (!content?.trim()) {
      return NextResponse.json({ error: "Empty content" }, { status: 400 });
    }
    const row = await postAgentMessage(path[1], content.trim());
    return NextResponse.json({ ok: true, messageId: row.id });
  }

  // POST vacancy/:id/candidate/:candidateId/evaluate
  if (
    path.length === 5 &&
    path[0] === "vacancy" &&
    path[2] === "candidate" &&
    path[4] === "evaluate"
  ) {
    const scoped = await scopedCandidate(path[1], path[3]);
    if (!scoped) return new Response("Not found", { status: 404 });
    await evaluateCandidate(path[3]); // best-effort, idempotent
    return getCandidateDetail(path[1], path[3]);
  }

  // POST vacancy/:id/notify {candidateName, aiScore, kind}
  if (path.length === 3 && path[0] === "vacancy" && path[2] === "notify") {
    const body = (await req.json()) as NotifyRequest;
    return notifyRecruiter(path[1], body);
  }

  return new Response("Not found", { status: 404 });
}

/* ------------------------------ handlers ------------------------------- */

async function getVacancyContext(vacancyId: string) {
  const vac = await getVacancyById(vacancyId);
  if (!vac?.organizationId) return new Response("Not found", { status: 404 });

  const [org, agent, questions, pool] = await Promise.all([
    getOrganization(vac.organizationId),
    ensureVacancyAgent(vacancyId),
    db
      .select()
      .from(interviewQuestion)
      .where(eq(interviewQuestion.vacancyId, vacancyId))
      .orderBy(asc(interviewQuestion.orderIndex)),
    db.select().from(candidate).where(eq(candidate.vacancyId, vacancyId)),
  ]);

  const ctx: VacancyContext = {
    vacancyId,
    title: vac.title,
    status: vac.status,
    companyName: org?.name ?? null,
    companyDescriptionMd: org?.descriptionMd ?? null,
    instructions: agent.enabled ? agent.instructions : null,
    questions: questions.map((q) => q.text),
    pool: pool.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      aiScore: c.aiScore,
      rating: c.rating,
      appliedAt: c.createdAt.toISOString(),
      completedAt: c.completedAt?.toISOString() ?? null,
    })),
  };
  // The worker checks `status` itself, but expose enabled as a hard stop too.
  if (!agent.enabled) ctx.status = "agent_disabled";
  return NextResponse.json(ctx);
}

async function scopedCandidate(vacancyId: string, candidateId: string) {
  const [c] = await db
    .select()
    .from(candidate)
    .where(eq(candidate.id, candidateId))
    .limit(1);
  return c && c.vacancyId === vacancyId ? c : null;
}

async function getCandidateDetail(vacancyId: string, candidateId: string) {
  const c = await scopedCandidate(vacancyId, candidateId);
  if (!c) return new Response("Not found", { status: 404 });

  const [questions, answers] = await Promise.all([
    db
      .select()
      .from(interviewQuestion)
      .where(eq(interviewQuestion.vacancyId, vacancyId))
      .orderBy(asc(interviewQuestion.orderIndex)),
    db
      .select()
      .from(interviewAnswer)
      .where(eq(interviewAnswer.candidateId, candidateId)),
  ]);
  const byQuestion = new Map(answers.map((a) => [a.questionId, a]));

  const detail: CandidateDetail = {
    id: c.id,
    name: c.name,
    status: c.status,
    aiScore: c.aiScore,
    aiEvaluation: c.aiEvaluation,
    answers: questions.map((q) => ({
      question: q.text,
      transcript: byQuestion.get(q.id)?.transcript ?? null,
    })),
  };
  return NextResponse.json(detail);
}

async function notifyRecruiter(vacancyId: string, body: NotifyRequest) {
  const [row] = await db
    .select({ email: user.email, title: vacancy.title })
    .from(vacancy)
    .innerJoin(user, eq(vacancy.userId, user.id))
    .where(eq(vacancy.id, vacancyId))
    .limit(1);
  if (!row) return new Response("Not found", { status: 404 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = `${appUrl}/app/v/${vacancyId}`;
  try {
    if (body.kind === "agent") {
      await sendAgentReviewEmail(row.email, {
        candidateName: body.candidateName,
        vacancyTitle: row.title,
        aiScore: body.aiScore,
        url,
      });
    } else {
      await sendInterviewCompletedEmail(row.email, {
        candidateName: body.candidateName,
        vacancyTitle: row.title,
        url,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[agent-gateway] notify failed:", e);
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}
