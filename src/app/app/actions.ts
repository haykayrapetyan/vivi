"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  candidate,
  interviewQuestion,
  member,
  vacancy,
  type CandidateStatus,
  type VacancyStatus,
} from "@/lib/db/schema";
import { canTransition } from "@/lib/vacancy-lifecycle";
import { requireUser, requireUserAndOrg } from "@/lib/session";
import {
  getOwnedGroup,
  getOwnedVacancy,
  getVacancyQuestions,
} from "@/lib/data";
import { buildPublicSlug } from "@/lib/slug";
import { evaluateCandidate } from "@/lib/ai-eval";
import { dispatchAgentEvent } from "@/lib/agent/dispatch";
import { MAX_DRAFT_LEN } from "@/lib/draft";

/** Ensures the current user owns the vacancy the candidate belongs to. */
async function requireOwnedCandidate(candidateId: string) {
  const user = await requireUser();
  const [row] = await db
    .select({ candidateId: candidate.id, vacancyId: candidate.vacancyId })
    .from(candidate)
    .innerJoin(vacancy, eq(candidate.vacancyId, vacancy.id))
    .innerJoin(member, eq(member.organizationId, vacancy.organizationId))
    .where(and(eq(candidate.id, candidateId), eq(member.userId, user.id)))
    .limit(1);
  if (!row) throw new Error("Candidate not found");
  return row;
}

export async function rateCandidate(candidateId: string, rating: number) {
  const { vacancyId } = await requireOwnedCandidate(candidateId);
  const clamped = Math.max(0, Math.min(5, Math.round(rating)));
  await db
    .update(candidate)
    .set({ rating: clamped || null })
    .where(eq(candidate.id, candidateId));
  revalidatePath(`/app/v/${vacancyId}`);
}

export async function setCandidateStatus(
  candidateId: string,
  status: CandidateStatus,
) {
  const { vacancyId } = await requireOwnedCandidate(candidateId);
  await db
    .update(candidate)
    .set({ status })
    .where(eq(candidate.id, candidateId));
  revalidatePath(`/app/v/${vacancyId}`);
}

export async function rerunEvaluation(candidateId: string) {
  const { vacancyId } = await requireOwnedCandidate(candidateId);
  const ok = await evaluateCandidate(candidateId);
  revalidatePath(`/app/v/${vacancyId}`);
  return { ok };
}


/**
 * Starts a vacancy straight from a free-text prompt (landing-page composer).
 * Picks the org's first company, creating a default one for brand-new users,
 * then hands the prompt to the chat via a query param so the AI begins at once.
 */
export async function startVacancyFromPrompt(prompt: string) {
  const { user, organizationId } = await requireUserAndOrg();
  const text = prompt.trim().slice(0, MAX_DRAFT_LEN);

  const [v] = await db
    .insert(vacancy)
    .values({ userId: user.id, organizationId })
    .returning({ id: vacancy.id });

  revalidatePath("/app");
  const query = text ? `?prompt=${encodeURIComponent(text)}` : "";
  redirect(`/app/v/${v.id}${query}`);
}

export async function createVacancy(groupId?: string | null) {
  const { user, organizationId } = await requireUserAndOrg();
  let gid: string | null = null;
  if (groupId) {
    const owned = await getOwnedGroup(groupId, user.id);
    if (!owned) throw new Error("Group not found");
    gid = groupId;
  }
  const [v] = await db
    .insert(vacancy)
    .values({ userId: user.id, organizationId, groupId: gid })
    .returning({ id: vacancy.id });
  revalidatePath("/app");
  redirect(`/app/v/${v.id}`);
}

export async function renameVacancy(id: string, title: string) {
  const user = await requireUser();
  const owned = await getOwnedVacancy(id, user.id);
  if (!owned) throw new Error("Vacancy not found");
  const next = title.trim().slice(0, 120) || "New vacancy";
  await db.update(vacancy).set({ title: next }).where(eq(vacancy.id, id));
  revalidatePath("/app");
  revalidatePath(`/app/v/${id}`);
}

export async function deleteVacancy(id: string) {
  const user = await requireUser();
  const owned = await getOwnedVacancy(id, user.id);
  if (!owned) throw new Error("Vacancy not found");
  await db.delete(vacancy).where(eq(vacancy.id, id));
  revalidatePath("/app");
  redirect("/app");
}

/** Moves a vacancy into a group (or out of any group when groupId is null).
 * The target group must belong to the same company as the vacancy. */
export async function moveVacancyToGroup(id: string, groupId: string | null) {
  const user = await requireUser();
  const owned = await getOwnedVacancy(id, user.id);
  if (!owned) throw new Error("Vacancy not found");
  let gid: string | null = null;
  if (groupId) {
    const group = await getOwnedGroup(groupId, user.id);
    if (!group || group.organizationId !== owned.organizationId) {
      throw new Error("Group not found");
    }
    gid = groupId;
  }
  await db.update(vacancy).set({ groupId: gid }).where(eq(vacancy.id, id));
  revalidatePath("/app");
}

/** Reassigns the vacancy's responsible user. The new owner must be a member of
 * the vacancy's company. */
export async function setVacancyOwner(id: string, ownerId: string) {
  const user = await requireUser();
  const owned = await getOwnedVacancy(id, user.id);
  if (!owned?.organizationId) throw new Error("Vacancy not found");
  const [m] = await db
    .select({ id: member.id })
    .from(member)
    .where(
      and(
        eq(member.organizationId, owned.organizationId),
        eq(member.userId, ownerId),
      ),
    )
    .limit(1);
  if (!m) throw new Error("That user isn't a member of this company");
  await db.update(vacancy).set({ userId: ownerId }).where(eq(vacancy.id, id));
  revalidatePath(`/app/v/${id}`);
}

export async function publishVacancy(id: string) {
  const user = await requireUser();
  const owned = await getOwnedVacancy(id, user.id);
  if (!owned) throw new Error("Vacancy not found");

  if (!owned.descriptionMd) {
    throw new Error("Finish the vacancy description in the AI chat first.");
  }
  const questions = await getVacancyQuestions(id);
  if (questions.length === 0) {
    throw new Error("You need at least one video-interview question.");
  }

  const slug = owned.publicSlug ?? buildPublicSlug(owned.title);
  await db
    .update(vacancy)
    .set({ status: "published", publicSlug: slug })
    .where(eq(vacancy.id, id));

  revalidatePath("/app");
  revalidatePath(`/app/v/${id}`);

  // Wake the vacancy's agent: it introduces itself in the chat (once) and
  // schedules its own periodic pool reviews. Best-effort — publishing never
  // fails over the agent.
  after(async () => {
    try {
      await dispatchAgentEvent({ type: "published", vacancyId: id });
    } catch (e) {
      console.error("[publish] agent kickoff dispatch failed:", e);
    }
  });

  return { slug };
}

export async function unpublishVacancy(id: string) {
  const user = await requireUser();
  const owned = await getOwnedVacancy(id, user.id);
  if (!owned) throw new Error("Vacancy not found");
  await db.update(vacancy).set({ status: "draft" }).where(eq(vacancy.id, id));
  revalidatePath("/app");
  revalidatePath(`/app/v/${id}`);
}

/**
 * Moves a vacancy through its lifecycle (close / reopen / archive / restore).
 * Closed and archived vacancies stop accepting candidates and the agent goes
 * dormant. Publishing a draft still goes through publishVacancy.
 */
export async function setVacancyStatus(id: string, status: VacancyStatus) {
  const user = await requireUser();
  const owned = await getOwnedVacancy(id, user.id);
  if (!owned) throw new Error("Vacancy not found");
  if (!canTransition(owned.status, status)) {
    throw new Error(`Cannot move a ${owned.status} vacancy to ${status}`);
  }
  await db.update(vacancy).set({ status }).where(eq(vacancy.id, id));
  revalidatePath("/app");
  revalidatePath(`/app/v/${id}`);

  // Reopening makes the agent live again — ping it so its schedule resumes.
  if (status === "published") {
    after(async () => {
      try {
        await dispatchAgentEvent({ type: "published", vacancyId: id });
      } catch (e) {
        console.error("[reopen] agent dispatch failed:", e);
      }
    });
  }
}

export async function updateVacancyDescription(
  id: string,
  descriptionMd: string,
) {
  const user = await requireUser();
  const owned = await getOwnedVacancy(id, user.id);
  if (!owned) throw new Error("Vacancy not found");
  await db
    .update(vacancy)
    .set({ descriptionMd: descriptionMd.trim() || null })
    .where(eq(vacancy.id, id));
  revalidatePath(`/app/v/${id}`);
}

// Replaces interview questions for a vacancy (used by manual edits).
export async function replaceQuestions(id: string, questions: string[]) {
  const user = await requireUser();
  const owned = await getOwnedVacancy(id, user.id);
  if (!owned) throw new Error("Vacancy not found");
  await db.delete(interviewQuestion).where(eq(interviewQuestion.vacancyId, id));
  if (questions.length) {
    await db.insert(interviewQuestion).values(
      questions
        .map((t) => t.trim())
        .filter(Boolean)
        .map((text, i) => ({ vacancyId: id, text, orderIndex: i })),
    );
  }
  revalidatePath(`/app/v/${id}`);
}
