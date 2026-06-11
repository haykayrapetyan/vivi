import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  candidate,
  interviewAnswer,
  interviewQuestion,
  vacancy,
  type Vacancy,
} from "@/lib/db/schema";
import { cleanUntrusted, untrustedBlock } from "./sanitize";

/**
 * Tools shared by the interactive vacancy chat and autonomous agent runs.
 * All access is scoped to the given (already access-checked) vacancy.
 */
export function buildVacancyTools(owned: Vacancy) {
  const vacancyId = owned.id;

  return {
    save_vacancy: tool({
      description:
        "Saves/updates the vacancy draft: title, Markdown description, and video-interview questions.",
      inputSchema: z.object({
        title: z.string().describe("Short vacancy title (the job title)"),
        descriptionMd: z
          .string()
          .describe("Full vacancy description in Markdown"),
        details: z
          .object({
            employmentType: z
              .string()
              .optional()
              .describe('Employment type, e.g. "Full-time"'),
            workMode: z
              .enum(["remote", "hybrid", "onsite"])
              .optional()
              .describe("Work mode: remote/hybrid/onsite"),
            location: z.string().optional().describe("City or address"),
            salaryMin: z.number().optional().describe("Salary from (number)"),
            salaryMax: z.number().optional().describe("Salary to (number)"),
            salaryCurrency: z
              .string()
              .optional()
              .describe("Currency: USD, EUR, GBP…"),
            salaryPeriod: z
              .enum(["month", "year", "hour"])
              .optional()
              .describe("Salary period"),
            seniority: z
              .string()
              .optional()
              .describe("Seniority: junior/middle/senior"),
            skills: z.array(z.string()).optional(),
          })
          .optional(),
        interviewQuestions: z
          .array(z.string())
          .min(3)
          .max(8)
          .describe("Open-ended questions for the candidate video interview"),
      }),
      execute: async ({ title, descriptionMd, details, interviewQuestions }) => {
        // Transactional so a failed insert can't leave the vacancy without
        // questions (delete+insert must be atomic).
        await db.transaction(async (tx) => {
          await tx
            .update(vacancy)
            .set({
              title: title?.trim() || owned.title,
              descriptionMd,
              details: details ?? owned.details ?? undefined,
            })
            .where(eq(vacancy.id, vacancyId));

          await tx
            .delete(interviewQuestion)
            .where(eq(interviewQuestion.vacancyId, vacancyId));
          await tx.insert(interviewQuestion).values(
            interviewQuestions
              .map((t) => t.trim())
              .filter(Boolean)
              .map((text, i) => ({ vacancyId, text, orderIndex: i })),
          );
        });

        return { ok: true, savedQuestions: interviewQuestions.length };
      },
    }),

    list_candidates: tool({
      description:
        "Lists all candidates for this vacancy: status, AI score, recruiter rating, completion time.",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await db
          .select()
          .from(candidate)
          .where(eq(candidate.vacancyId, vacancyId))
          .orderBy(desc(candidate.createdAt));
        return {
          candidates: rows.map((c) => ({
            id: c.id,
            name: cleanUntrusted(c.name, 120),
            status: c.status,
            aiScore: c.aiScore,
            rating: c.rating,
            appliedAt: c.createdAt.toISOString(),
            completedAt: c.completedAt?.toISOString() ?? null,
          })),
        };
      },
    }),

    get_candidate: tool({
      description:
        "Full candidate profile: contact info, AI evaluation, and interview answer transcripts.",
      inputSchema: z.object({
        candidateId: z.string().describe("Candidate id from list_candidates"),
      }),
      execute: async ({ candidateId }) => {
        const [c] = await db
          .select()
          .from(candidate)
          .where(eq(candidate.id, candidateId))
          .limit(1);
        // Scope check: only candidates of THIS vacancy.
        if (!c || c.vacancyId !== vacancyId) {
          return { error: "Candidate not found in this vacancy" };
        }

        const questions = await db
          .select()
          .from(interviewQuestion)
          .where(eq(interviewQuestion.vacancyId, vacancyId))
          .orderBy(asc(interviewQuestion.orderIndex));
        const answers = await db
          .select()
          .from(interviewAnswer)
          .where(eq(interviewAnswer.candidateId, candidateId));
        const byQuestion = new Map(answers.map((a) => [a.questionId, a]));

        return {
          id: c.id,
          name: cleanUntrusted(c.name, 120),
          email: cleanUntrusted(c.email, 200),
          status: c.status,
          rating: c.rating,
          aiScore: c.aiScore,
          aiEvaluation: c.aiEvaluation,
          completedAt: c.completedAt?.toISOString() ?? null,
          answers: questions.map((q, i) => {
            const a = byQuestion.get(q.id);
            return {
              question: q.text,
              transcript: a?.transcript
                ? untrustedBlock(`answer ${i + 1}`, a.transcript)
                : null,
              durationSec: a?.durationSec ?? null,
            };
          }),
        };
      },
    }),
  };
}
