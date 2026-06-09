"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  candidate,
  interviewQuestion,
  member,
  vacancy,
  type CandidateStatus,
} from "@/lib/db/schema";
import { requireUser, requireUserAndOrg } from "@/lib/session";
import { getOwnedCompany, getOwnedVacancy, getVacancyQuestions } from "@/lib/data";
import { buildPublicSlug } from "@/lib/slug";
import { evaluateCandidate } from "@/lib/ai-eval";

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
  if (!row) throw new Error("Кандидат не найден");
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

export async function createVacancy(companyId: string) {
  const { user, organizationId } = await requireUserAndOrg();
  const owned = await getOwnedCompany(companyId, user.id);
  if (!owned) throw new Error("Компания не найдена");
  const [v] = await db
    .insert(vacancy)
    .values({ userId: user.id, organizationId, companyId })
    .returning({ id: vacancy.id });
  revalidatePath("/app");
  redirect(`/app/v/${v.id}`);
}

export async function renameVacancy(id: string, title: string) {
  const user = await requireUser();
  const owned = await getOwnedVacancy(id, user.id);
  if (!owned) throw new Error("Вакансия не найдена");
  const next = title.trim().slice(0, 120) || "Новая вакансия";
  await db.update(vacancy).set({ title: next }).where(eq(vacancy.id, id));
  revalidatePath("/app");
  revalidatePath(`/app/v/${id}`);
}

export async function deleteVacancy(id: string) {
  const user = await requireUser();
  const owned = await getOwnedVacancy(id, user.id);
  if (!owned) throw new Error("Вакансия не найдена");
  await db.delete(vacancy).where(eq(vacancy.id, id));
  revalidatePath("/app");
  redirect("/app");
}

export async function publishVacancy(id: string) {
  const user = await requireUser();
  const owned = await getOwnedVacancy(id, user.id);
  if (!owned) throw new Error("Вакансия не найдена");

  if (!owned.descriptionMd) {
    throw new Error(
      "Сначала завершите описание вакансии в чате с AI.",
    );
  }
  const questions = await getVacancyQuestions(id);
  if (questions.length === 0) {
    throw new Error("Нужен хотя бы один вопрос для видеоинтервью.");
  }

  const slug = owned.publicSlug ?? buildPublicSlug(owned.title);
  await db
    .update(vacancy)
    .set({ status: "published", publicSlug: slug })
    .where(eq(vacancy.id, id));

  revalidatePath("/app");
  revalidatePath(`/app/v/${id}`);
  return { slug };
}

export async function unpublishVacancy(id: string) {
  const user = await requireUser();
  const owned = await getOwnedVacancy(id, user.id);
  if (!owned) throw new Error("Вакансия не найдена");
  await db.update(vacancy).set({ status: "draft" }).where(eq(vacancy.id, id));
  revalidatePath("/app");
  revalidatePath(`/app/v/${id}`);
}

export async function setVacancyClosed(id: string, closed: boolean) {
  const user = await requireUser();
  const owned = await getOwnedVacancy(id, user.id);
  if (!owned) throw new Error("Вакансия не найдена");
  await db
    .update(vacancy)
    .set({ status: closed ? "closed" : "published" })
    .where(eq(vacancy.id, id));
  revalidatePath("/app");
  revalidatePath(`/app/v/${id}`);
}

export async function updateVacancyDescription(
  id: string,
  descriptionMd: string,
) {
  const user = await requireUser();
  const owned = await getOwnedVacancy(id, user.id);
  if (!owned) throw new Error("Вакансия не найдена");
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
  if (!owned) throw new Error("Вакансия не найдена");
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
