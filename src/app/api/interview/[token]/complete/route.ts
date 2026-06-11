import { NextResponse, after } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { candidate } from "@/lib/db/schema";
import { getCandidateByToken, getVacancyById } from "@/lib/data";
import { isAcceptingCandidates } from "@/lib/vacancy-lifecycle";
import { dispatchAgentEvent } from "@/lib/agent/dispatch";
import { runCandidateCompleted } from "@/lib/agent/run";

// The inline fallback path transcribes + evaluates + screens after the
// response — allow long executions where the platform supports it.
export const maxDuration = 300;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const cand = await getCandidateByToken(token);
  if (!cand) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const vac = await getVacancyById(cand.vacancyId);
  if (!vac || !isAcceptingCandidates(vac.status)) {
    return NextResponse.json(
      { error: "This vacancy is no longer accepting interviews" },
      { status: 410 },
    );
  }

  await db
    .update(candidate)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(candidate.id, cand.id));

  // Hand the rest (evaluation, agent screening, recruiter notification) to
  // the vacancy's agent on Cloudflare; when the worker isn't running (e.g.
  // dev without `pnpm dev:agent`), run inline after the response so the
  // candidate never waits on AI work.
  after(async () => {
    try {
      const dispatched = await dispatchAgentEvent({
        type: "candidate_completed",
        vacancyId: cand.vacancyId,
        candidateId: cand.id,
      });
      if (!dispatched) await runCandidateCompleted(cand.id);
    } catch (e) {
      console.error("[complete] agent screening failed:", e);
    }
  });

  return NextResponse.json({ ok: true });
}
