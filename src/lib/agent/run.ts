import "server-only";
import { asc, eq } from "drizzle-orm";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { db } from "@/lib/db";
import {
  candidate,
  interviewAnswer,
  interviewQuestion,
  user,
  vacancy,
} from "@/lib/db/schema";
import { getOrganization, getVacancyById } from "@/lib/data";
import { evaluateCandidate } from "@/lib/ai-eval";
import {
  sendAgentReviewEmail,
  sendInterviewCompletedEmail,
} from "@/lib/email";
import { screenKey } from "./keys";
import { buildAgentSystemPrompt, buildScreeningPrompt } from "./prompt";
import {
  ensureVacancyAgent,
  finishAgentRun,
  hasAgentTask,
  postAgentMessage,
  recordAgentTask,
  startAgentRun,
} from "./store";

const hasOpenAI = () => Boolean(process.env.OPENAI_API_KEY);

/**
 * Autonomous agent run for a completed interview: evaluate the candidate
 * (existing pipeline), post a screening analysis into the vacancy chat, and
 * notify the recruiter. Idempotent per candidate via agent_task. Falls back
 * to the legacy behavior (eval + plain notification email) when the agent is
 * disabled or OpenAI is not configured. Throws on failure so queue retries
 * can kick in.
 */
export async function runCandidateCompleted(candidateId: string) {
  const [cand] = await db
    .select()
    .from(candidate)
    .where(eq(candidate.id, candidateId))
    .limit(1);
  if (!cand) return;

  const vac = await getVacancyById(cand.vacancyId);
  // A vacancy without an org is inaccessible by definition — don't act on it.
  if (!vac?.organizationId) return;
  // The agent lives and dies with the vacancy lifecycle: closed/archived
  // vacancies take no work (the interview routes reject too — this is
  // belt-and-suspenders for queued events).
  if (vac.status !== "published") return;

  const key = screenKey(candidateId);
  if (await hasAgentTask(key)) return; // already screened (retry/duplicate)

  const agent = await ensureVacancyAgent(vac.id);
  const runId = await startAgentRun(vac.id, "candidate_completed");

  try {
    // Always evaluate — this is today's behavior and it's idempotent.
    await evaluateCandidate(candidateId);

    let analysisPosted = false;
    let latestScore = cand.aiScore;
    if (agent.enabled && hasOpenAI()) {
      // Re-read the candidate so the prompt sees the fresh evaluation.
      const [fresh] = await db
        .select()
        .from(candidate)
        .where(eq(candidate.id, candidateId))
        .limit(1);
      latestScore = fresh.aiScore;

      const questions = await db
        .select()
        .from(interviewQuestion)
        .where(eq(interviewQuestion.vacancyId, vac.id))
        .orderBy(asc(interviewQuestion.orderIndex));
      const answers = await db
        .select()
        .from(interviewAnswer)
        .where(eq(interviewAnswer.candidateId, candidateId));
      const byQuestion = new Map(answers.map((a) => [a.questionId, a]));

      const pool = await db
        .select()
        .from(candidate)
        .where(eq(candidate.vacancyId, vac.id))
        .then((rows) => rows.filter((c) => c.id !== candidateId));

      const org = await getOrganization(vac.organizationId);

      const { text } = await generateText({
        model: openai(process.env.OPENAI_MODEL ?? "gpt-4o"),
        system: buildAgentSystemPrompt({
          vacancyTitle: vac.title,
          vacancyStatus: vac.status,
          companyName: org?.name,
          companyDescriptionMd: org?.descriptionMd,
          instructions: agent.instructions,
        }),
        prompt: buildScreeningPrompt({
          candidateName: fresh.name,
          answers: questions.map((q) => ({
            question: q.text,
            transcript: byQuestion.get(q.id)?.transcript ?? null,
          })),
          aiScore: fresh.aiScore,
          aiEvaluation: fresh.aiEvaluation,
          pool: pool.map((p) => ({
            name: p.name,
            status: p.status,
            aiScore: p.aiScore,
            rating: p.rating,
          })),
        }),
      });

      if (text.trim()) {
        await postAgentMessage(vac.id, text.trim());
        analysisPosted = true;
      }
    }

    await notifyRecruiter(vac.id, vac.title, cand.name, analysisPosted, latestScore);

    await recordAgentTask(vac.id, key, runId);
    await finishAgentRun(runId, {
      status: agent.enabled ? "done" : "skipped",
      summary: analysisPosted
        ? `Screened ${cand.name}: analysis posted to chat`
        : `Candidate ${cand.name} completed; legacy notification sent (agent ${
            agent.enabled ? "had no model" : "disabled"
          })`,
    });
  } catch (e) {
    await finishAgentRun(runId, {
      status: "failed",
      error: e instanceof Error ? e.message : String(e),
    });
    throw e; // let the queue retry
  }
}

/** Emails the vacancy owner (same recipient as the legacy /complete flow). */
async function notifyRecruiter(
  vacancyId: string,
  vacancyTitle: string,
  candidateName: string,
  agentReviewed: boolean,
  aiScore: number | null,
) {
  try {
    const [row] = await db
      .select({ email: user.email })
      .from(vacancy)
      .innerJoin(user, eq(vacancy.userId, user.id))
      .where(eq(vacancy.id, vacancyId))
      .limit(1);
    if (!row) return;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const url = `${appUrl}/app/v/${vacancyId}`;
    if (agentReviewed) {
      await sendAgentReviewEmail(row.email, {
        candidateName,
        vacancyTitle,
        aiScore,
        url,
      });
    } else {
      await sendInterviewCompletedEmail(row.email, {
        candidateName,
        vacancyTitle,
        url,
      });
    }
  } catch (e) {
    // Notification is best-effort — never fail the run over email.
    console.error("[agent] notify failed:", e);
  }
}
