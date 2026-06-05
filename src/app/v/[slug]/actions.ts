"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { candidate } from "@/lib/db/schema";
import { getPublicVacancy } from "@/lib/data";
import { isEmail } from "@/lib/validation";

export async function applyToVacancy(
  slug: string,
  data: { name: string; email: string; phone?: string },
) {
  const vacancy = await getPublicVacancy(slug);
  if (!vacancy) throw new Error("Вакансия не найдена или снята с публикации");

  const name = data.name.trim();
  const email = data.email.trim().toLowerCase();
  const phone = data.phone?.trim() || null;

  if (name.length < 2) throw new Error("Укажите имя");
  if (!isEmail(email)) throw new Error("Укажите корректный email");

  const [row] = await db
    .insert(candidate)
    .values({ vacancyId: vacancy.id, name, email, phone, status: "applied" })
    .returning({ token: candidate.publicToken });

  redirect(`/interview/${row.token}`);
}
