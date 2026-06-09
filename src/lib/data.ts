import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  candidate,
  chatMessage,
  company,
  interviewAnswer,
  interviewQuestion,
  member,
  organization,
  vacancy,
} from "@/lib/db/schema";

export async function listCompanies(organizationId: string) {
  return db
    .select()
    .from(company)
    .where(eq(company.organizationId, organizationId))
    .orderBy(asc(company.createdAt));
}

/** Loads a company and enforces org membership. */
export async function getOwnedCompany(id: string, userId: string) {
  const [c] = await db.select().from(company).where(eq(company.id, id)).limit(1);
  if (!c) return null;
  const [m] = await db
    .select({ id: member.id })
    .from(member)
    .where(
      and(eq(member.organizationId, c.organizationId), eq(member.userId, userId)),
    )
    .limit(1);
  return m ? c : null;
}

export async function getUserOrganizations(userId: string) {
  return db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      role: member.role,
    })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(eq(member.userId, userId))
    .orderBy(asc(organization.createdAt));
}

export async function listVacancies(organizationId: string) {
  return db
    .select()
    .from(vacancy)
    .where(eq(vacancy.organizationId, organizationId))
    .orderBy(desc(vacancy.updatedAt));
}

/**
 * Loads a vacancy and enforces access: the user must be a member of the
 * vacancy's organization. Returns null otherwise.
 */
export async function getOwnedVacancy(id: string, userId: string) {
  const [v] = await db.select().from(vacancy).where(eq(vacancy.id, id)).limit(1);
  if (!v?.organizationId) return null;
  const [m] = await db
    .select({ id: member.id })
    .from(member)
    .where(
      and(
        eq(member.organizationId, v.organizationId),
        eq(member.userId, userId),
      ),
    )
    .limit(1);
  return m ? v : null;
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
      transcript: interviewAnswer.transcript,
      createdAt: interviewAnswer.createdAt,
    })
    .from(interviewAnswer)
    .innerJoin(candidate, eq(interviewAnswer.candidateId, candidate.id))
    .where(eq(candidate.vacancyId, vacancyId))
    .orderBy(asc(interviewAnswer.createdAt));
}

export async function getCompanyById(id: string) {
  const [c] = await db.select().from(company).where(eq(company.id, id)).limit(1);
  return c ?? null;
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
