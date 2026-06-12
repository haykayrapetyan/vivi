import "server-only";
import { tool } from "ai";
import { openai } from "@ai-sdk/openai";
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
import { safeFetch } from "@/lib/safe-fetch";
import { buildPublicSlug } from "@/lib/slug";
import { canTransition } from "@/lib/vacancy-lifecycle";
import { cleanUntrusted, untrustedBlock } from "./sanitize";
import { setAgentInstructions } from "./store";

/** Fetches a public web page and returns its readable text (SSRF-guarded). */
async function readUrlText(url: string): Promise<string> {
  const res = await safeFetch(url, {
    headers: { accept: "text/html,text/plain" },
  });
  if (!res) throw new Error("URL is unreachable or blocked");
  const ct = res.headers.get("content-type") ?? "";
  if (!/text|html|json/.test(ct)) {
    return `[unsupported content type: ${ct || "unknown"}]`;
  }
  const html = await res.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 6000);
}

/**
 * Tools for the interactive vacancy chat (the autonomous worker has its own
 * gateway-backed equivalents). All access is scoped to the given (already
 * access-checked) vacancy.
 */
export function buildVacancyTools(owned: Vacancy) {
  const vacancyId = owned.id;

  return {
    // OpenAI's hosted web search — the agent can look things up live
    // (salary benchmarks, market context, how peers describe a role, etc.).
    web_search: openai.tools.webSearch({}),

    fetch_url: tool({
      description:
        "Fetches a public web page (e.g. a company careers page, a reference job posting the recruiter linked) and returns its readable text so you can use the real content.",
      inputSchema: z.object({
        url: z.string().describe("Absolute http(s) URL to read"),
      }),
      execute: async ({ url }) => {
        try {
          const text = await readUrlText(url);
          return { ok: true, text: untrustedBlock("web page", text) };
        } catch (e) {
          return {
            ok: false,
            error: e instanceof Error ? e.message : "Could not fetch the URL",
          };
        }
      },
    }),

    set_agent_instructions: tool({
      description:
        "Persists the recruiter's STANDING instructions for this vacancy's autonomous agent (applied in every future run: screenings, periodic reviews). Pass an empty string to clear. Not for one-off requests.",
      inputSchema: z.object({
        instructions: z
          .string()
          .max(2000)
          .describe(
            "The full standing instructions to keep (replaces the previous ones), or empty to clear",
          ),
      }),
      execute: async ({ instructions }) => {
        await setAgentInstructions(vacancyId, instructions);
        return { ok: true, cleared: !instructions.trim() };
      },
    }),

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

    get_vacancy_overview: tool({
      description:
        "The full current state of THIS vacancy: title, status, description, structured details (work mode, salary, skills…), the interview questions, public link, and analytics (views, applications, completion, shortlist, average AI score). Use this to see everything before advising or acting.",
      inputSchema: z.object({}),
      execute: async () => {
        const [v] = await db
          .select()
          .from(vacancy)
          .where(eq(vacancy.id, vacancyId))
          .limit(1);
        if (!v) return { error: "Vacancy not found" };

        const questions = await db
          .select()
          .from(interviewQuestion)
          .where(eq(interviewQuestion.vacancyId, vacancyId))
          .orderBy(asc(interviewQuestion.orderIndex));
        const cands = await db
          .select()
          .from(candidate)
          .where(eq(candidate.vacancyId, vacancyId));

        const byStatus: Record<string, number> = {};
        for (const c of cands) byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
        const scores = cands
          .map((c) => c.aiScore)
          .filter((s): s is number => s != null);
        const completed = cands.filter(
          (c) => c.completedAt != null,
        ).length;

        const appUrl =
          process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        return {
          title: v.title,
          status: v.status,
          descriptionMd: v.descriptionMd,
          details: v.details,
          publicUrl:
            v.status === "published" && v.publicSlug
              ? `${appUrl}/v/${v.publicSlug}`
              : null,
          questions: questions.map((q) => q.text),
          analytics: {
            views: v.viewCount,
            applications: cands.length,
            completedInterviews: completed,
            byStatus,
            shortlisted: byStatus["shortlisted"] ?? 0,
            avgAiScore: scores.length
              ? Number(
                  (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1),
                )
              : null,
          },
        };
      },
    }),

    set_vacancy_status: tool({
      description:
        "Changes the vacancy's lifecycle status when the recruiter asks. Allowed: publish a ready draft, close a published vacancy (stops new applicants), reopen a closed one, archive, or restore an archived one to draft. Publishing requires a description and at least one interview question.",
      inputSchema: z.object({
        status: z
          .enum(["published", "closed", "archived", "draft"])
          .describe("Target status"),
      }),
      execute: async ({ status }) => {
        const [v] = await db
          .select()
          .from(vacancy)
          .where(eq(vacancy.id, vacancyId))
          .limit(1);
        if (!v) return { error: "Vacancy not found" };
        if (v.status === status) return { ok: true, status, noChange: true };

        // Publishing a draft has its own validation + slug build.
        if (status === "published" && v.status === "draft") {
          if (!v.descriptionMd) {
            return { error: "Add a description before publishing." };
          }
          const qCount = await db
            .select({ id: interviewQuestion.id })
            .from(interviewQuestion)
            .where(eq(interviewQuestion.vacancyId, vacancyId));
          if (qCount.length === 0) {
            return { error: "Add at least one interview question first." };
          }
          const slug = v.publicSlug ?? buildPublicSlug(v.title);
          await db
            .update(vacancy)
            .set({ status: "published", publicSlug: slug })
            .where(eq(vacancy.id, vacancyId));
          return { ok: true, status: "published" };
        }

        if (!canTransition(v.status, status)) {
          return {
            error: `Can't move a ${v.status} vacancy to ${status}.`,
          };
        }
        await db
          .update(vacancy)
          .set({ status })
          .where(eq(vacancy.id, vacancyId));
        return { ok: true, status };
      },
    }),

    set_candidate: tool({
      description:
        "Updates a candidate in this vacancy: move their pipeline status (shortlisted / rejected / etc.) and/or set the recruiter rating (0–5). Use when the recruiter asks you to shortlist, reject, or rate someone.",
      inputSchema: z.object({
        candidateId: z.string().describe("Candidate id from list_candidates"),
        status: z
          .enum([
            "applied",
            "interviewing",
            "completed",
            "shortlisted",
            "rejected",
          ])
          .optional(),
        rating: z
          .number()
          .int()
          .min(0)
          .max(5)
          .optional()
          .describe("Recruiter rating, 0 clears it"),
      }),
      execute: async ({ candidateId, status, rating }) => {
        const [c] = await db
          .select()
          .from(candidate)
          .where(eq(candidate.id, candidateId))
          .limit(1);
        if (!c || c.vacancyId !== vacancyId) {
          return { error: "Candidate not found in this vacancy" };
        }
        const patch: Partial<typeof candidate.$inferInsert> = {};
        if (status) patch.status = status;
        if (rating !== undefined) patch.rating = rating || null;
        if (Object.keys(patch).length === 0) {
          return { error: "Nothing to update" };
        }
        await db.update(candidate).set(patch).where(eq(candidate.id, candidateId));
        return { ok: true, candidateId, ...patch };
      },
    }),
  };
}
