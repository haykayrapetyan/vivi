"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { candidate } from "@/lib/db/schema";
import { getPublicVacancy } from "@/lib/data";
import { isEmail } from "@/lib/validation";
import { isAcceptingCandidates } from "@/lib/vacancy-lifecycle";

export async function applyToVacancy(
  slug: string,
  data: { name: string; email: string; phone?: string },
) {
  const vacancy = await getPublicVacancy(slug);
  if (!vacancy) throw new Error("Vacancy not found or no longer published");
  if (!isAcceptingCandidates(vacancy.status)) {
    throw new Error("This vacancy is no longer accepting applications");
  }

  const name = data.name.trim();
  const email = data.email.trim().toLowerCase();
  const phone = data.phone?.trim() || null;

  if (name.length < 2) throw new Error("Please enter your name");
  if (!isEmail(email)) throw new Error("Please enter a valid email");

  const [row] = await db
    .insert(candidate)
    .values({ vacancyId: vacancy.id, name, email, phone, status: "applied" })
    .returning({ token: candidate.publicToken });

  redirect(`/interview/${row.token}`);
}
