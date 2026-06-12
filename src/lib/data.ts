import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  candidate,
  candidateView,
  chatMessage,
  chatRead,
  group,
  interviewAnswer,
  interviewQuestion,
  member,
  organization,
  user,
  vacancy,
  vacancyAgent,
} from "@/lib/db/schema";

/** The user's saved theme preference (from their profile). */
export async function getUserTheme(
  userId: string,
): Promise<"light" | "dark" | null> {
  const [u] = await db
    .select({ theme: user.theme })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return u?.theme ?? null;
}

/** Lists the (optional) vacancy groups inside a company (organization). */
export async function listGroups(organizationId: string) {
  return db
    .select()
    .from(group)
    .where(eq(group.organizationId, organizationId))
    .orderBy(asc(group.createdAt));
}

/** Loads a group and enforces org membership. */
export async function getOwnedGroup(id: string, userId: string) {
  const [g] = await db.select().from(group).where(eq(group.id, id)).limit(1);
  if (!g) return null;
  const [m] = await db
    .select({ id: member.id })
    .from(member)
    .where(
      and(eq(member.organizationId, g.organizationId), eq(member.userId, userId)),
    )
    .limit(1);
  return m ? g : null;
}

/** The company (organization) profile: name, website, AI description, logo. */
export async function getOrganization(organizationId: string) {
  const [o] = await db
    .select()
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);
  return o ?? null;
}

/** Members of an organization with their profile basics (for owner pickers,
 * member lists). */
export async function getOrgMembers(organizationId: string) {
  return db
    .select({
      userId: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: member.role,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, organizationId))
    .orderBy(asc(user.name));
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

/**
 * Unread autonomous agent messages per vacancy for one org member (their
 * chat_read cursor; no row = everything is unread). Powers sidebar badges.
 */
export async function getUnreadAgentCounts(
  organizationId: string,
  userId: string,
): Promise<Map<string, number>> {
  const rows = await db
    .select({
      vacancyId: chatMessage.vacancyId,
      count: sql<number>`count(*)`,
    })
    .from(chatMessage)
    .innerJoin(vacancy, eq(chatMessage.vacancyId, vacancy.id))
    .leftJoin(
      chatRead,
      and(
        eq(chatRead.vacancyId, chatMessage.vacancyId),
        eq(chatRead.userId, userId),
      ),
    )
    .where(
      and(
        eq(vacancy.organizationId, organizationId),
        eq(chatMessage.source, "auto"),
        sql`${chatMessage.createdAt} > coalesce(${chatRead.lastReadAt}, 'epoch'::timestamp)`,
      ),
    )
    .groupBy(chatMessage.vacancyId);
  return new Map(rows.map((r) => [r.vacancyId, Number(r.count)]));
}

/** Candidate ids this user has already opened (for "New" labels). */
export async function getViewedCandidateIds(
  userId: string,
  vacancyId: string,
): Promise<Set<string>> {
  const rows = await db
    .select({ candidateId: candidateView.candidateId })
    .from(candidateView)
    .innerJoin(candidate, eq(candidateView.candidateId, candidate.id))
    .where(
      and(eq(candidateView.userId, userId), eq(candidate.vacancyId, vacancyId)),
    );
  return new Set(rows.map((r) => r.candidateId));
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


/**
 * Public: fetch a vacancy by its slug. Returns published AND closed vacancies
 * (the page shows a "no longer accepting" notice for closed ones); drafts and
 * archived vacancies stay hidden. Status checks for writes happen in actions.
 */
export async function getPublicVacancy(slug: string) {
  const [v] = await db
    .select()
    .from(vacancy)
    .where(
      and(
        eq(vacancy.publicSlug, slug),
        inArray(vacancy.status, ["published", "closed"]),
      ),
    )
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

/** The vacancy's agent settings row, or null if not created yet (defaults apply). */
export async function getVacancyAgent(vacancyId: string) {
  const [a] = await db
    .select()
    .from(vacancyAgent)
    .where(eq(vacancyAgent.vacancyId, vacancyId))
    .limit(1);
  return a ?? null;
}
