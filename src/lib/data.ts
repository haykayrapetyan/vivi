import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  candidate,
  chatMessage,
  interviewAnswer,
  interviewQuestion,
  vacancy,
} from "@/lib/db/schema";

export async function listVacancies(userId: string) {
  return db
    .select()
    .from(vacancy)
    .where(eq(vacancy.userId, userId))
    .orderBy(desc(vacancy.updatedAt));
}

/** Loads a vacancy and enforces ownership. Returns null if not found/owned. */
export async function getOwnedVacancy(id: string, userId: string) {
  const [v] = await db
    .select()
    .from(vacancy)
    .where(and(eq(vacancy.id, id), eq(vacancy.userId, userId)))
    .limit(1);
  return v ?? null;
}

export async function getVacancyMessages(vacancyId: string) {
  return db
    .select()
    .from(chatMessage)
    .where(eq(chatMessage.vacancyId, vacancyId))
    .orderBy(asc(chatMessage.createdAt));
}

export async function getVacancyQuestions(vacancyId: string) {
  return db
    .select()
    .from(interviewQuestion)
    .where(eq(interviewQuestion.vacancyId, vacancyId))
    .orderBy(asc(interviewQuestion.orderIndex));
}

export async function getVacancyCandidates(vacancyId: string) {
  return db
    .select()
    .from(candidate)
    .where(eq(candidate.vacancyId, vacancyId))
    .orderBy(desc(candidate.createdAt));
}

export async function getCandidateAnswers(candidateId: string) {
  return db
    .select()
    .from(interviewAnswer)
    .where(eq(interviewAnswer.candidateId, candidateId))
    .orderBy(asc(interviewAnswer.createdAt));
}

/** All answers for every candidate of a vacancy (for the review panel). */
export async function getAnswersByVacancy(vacancyId: string) {
  return db
    .select({
      id: interviewAnswer.id,
      candidateId: interviewAnswer.candidateId,
      questionId: interviewAnswer.questionId,
      durationSec: interviewAnswer.durationSec,
      createdAt: interviewAnswer.createdAt,
    })
    .from(interviewAnswer)
    .innerJoin(candidate, eq(interviewAnswer.candidateId, candidate.id))
    .where(eq(candidate.vacancyId, vacancyId))
    .orderBy(asc(interviewAnswer.createdAt));
}

/** Public: fetch a published vacancy by its slug. */
export async function getPublicVacancy(slug: string) {
  const [v] = await db
    .select()
    .from(vacancy)
    .where(and(eq(vacancy.publicSlug, slug), eq(vacancy.status, "published")))
    .limit(1);
  return v ?? null;
}

export async function getCandidateByToken(token: string) {
  const [c] = await db
    .select()
    .from(candidate)
    .where(eq(candidate.publicToken, token))
    .limit(1);
  return c ?? null;
}

export async function getVacancyById(id: string) {
  const [v] = await db.select().from(vacancy).where(eq(vacancy.id, id)).limit(1);
  return v ?? null;
}
