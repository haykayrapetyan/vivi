import "server-only";
import { asc, eq } from "drizzle-orm";
import { experimental_transcribe as transcribe, generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  candidate,
  interviewAnswer,
  interviewQuestion,
  vacancy,
} from "@/lib/db/schema";
import { readVideo } from "@/lib/storage";
import { EVALUATION_RUBRIC } from "@/lib/agent/prompt";

function hasOpenAI() {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** Transcribes an audio/video buffer. Returns null on failure or no key. */
export async function transcribeBuffer(buffer: Buffer): Promise<string | null> {
  if (!hasOpenAI()) return null;
  try {
    const { text } = await transcribe({
      // gpt-4o-mini-transcribe is multilingual (incl. Russian) and, unlike
      // whisper-1, rarely hallucinates stock phrases on short/quiet clips —
      // which is what made dictation look like it "didn't understand Russian".
      model: openai.transcription(
        process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-mini-transcribe",
      ),
      audio: new Uint8Array(buffer),
    });
    return text?.trim() || null;
  } catch (e) {
    console.error("[ai-eval] transcription failed:", e);
    return null;
  }
}

const evalSchema = z.object({
  summary: z.string().describe("Short candidate summary, 2–4 sentences"),
  strengths: z.array(z.string()).describe("The candidate's strengths"),
  concerns: z.array(z.string()).describe("Risks and weak spots"),
  recommendation: z
    .string()
    .describe("A one-sentence recommendation for the recruiter"),
  score: z
    .number()
    .int()
    .min(1)
    .max(10)
    .describe("Fit score for the role from 1 to 10"),
});

/**
 * Builds an AI evaluation for a candidate from their answer transcripts.
 * Backfills any missing transcripts first. Best-effort: returns false if the
 * model is unavailable or the call fails. Safe to re-run (idempotent overwrite).
 */
export async function evaluateCandidate(candidateId: string): Promise<boolean> {
  if (!hasOpenAI()) return false;

  const [cand] = await db
    .select()
    .from(candidate)
    .where(eq(candidate.id, candidateId))
    .limit(1);
  if (!cand) return false;

  const [vac] = await db
    .select()
    .from(vacancy)
    .where(eq(vacancy.id, cand.vacancyId))
    .limit(1);
  if (!vac) return false;

  const questions = await db
    .select()
    .from(interviewQuestion)
    .where(eq(interviewQuestion.vacancyId, cand.vacancyId))
    .orderBy(asc(interviewQuestion.orderIndex));

  const answers = await db
    .select()
    .from(interviewAnswer)
    .where(eq(interviewAnswer.candidateId, candidateId));
  const answerByQ = new Map(answers.map((a) => [a.questionId, a]));

  // Backfill missing transcripts (best-effort).
  for (const a of answers) {
    if (a.transcript) continue;
    try {
      const buf = await readVideo(a.videoPath);
      const text = await transcribeBuffer(buf);
      if (text) {
        await db
          .update(interviewAnswer)
          .set({ transcript: text })
          .where(eq(interviewAnswer.id, a.id));
        a.transcript = text;
      }
    } catch (e) {
      console.error("[ai-eval] transcript backfill failed:", e);
    }
  }

  const qa = questions
    .map((q, i) => {
      const t = answerByQ.get(q.id)?.transcript?.trim();
      return `Question ${i + 1}: ${q.text}\nAnswer: ${
        t || "[answer missing or not recognized]"
      }`;
    })
    .join("\n\n");

  const prompt = `You are an expert recruiter evaluating a candidate from their video-interview answers. Be objective and rely only on the content of the answers.

How to evaluate (recruiting methodology):
${EVALUATION_RUBRIC}

Role: ${vac.title}
${vac.descriptionMd ? `Description:\n${vac.descriptionMd}\n` : ""}
Candidate: ${cand.name}

Answers (transcripts):
${qa}

Give your evaluation in English. The score (1–10) must reflect fit for THIS role per the rubric above.`;

  try {
    const { object } = await generateObject({
      model: openai(process.env.OPENAI_MODEL ?? "gpt-4o"),
      schema: evalSchema,
      prompt,
    });
    await db
      .update(candidate)
      .set({
        aiScore: object.score,
        aiEvaluation: {
          summary: object.summary,
          strengths: object.strengths,
          concerns: object.concerns,
          recommendation: object.recommendation,
        },
        aiEvaluatedAt: new Date(),
      })
      .where(eq(candidate.id, candidateId));
    return true;
  } catch (e) {
    console.error("[ai-eval] evaluation failed:", e);
    return false;
  }
}
