"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { company } from "@/lib/db/schema";
import { requireUserAndOrg } from "@/lib/session";
import { getOwnedCompany } from "@/lib/data";
import { generateCompanyDescription, normalizeUrl } from "@/lib/company-ai";

function cleanWebsite(website: string | null | undefined): string | null {
  if (!website || !website.trim()) return null;
  return normalizeUrl(website) ?? null;
}

export async function createCompany(name: string, website: string | null) {
  const { organizationId } = await requireUserAndOrg();
  const cleanName = name.trim().slice(0, 120) || "Компания";
  const site = cleanWebsite(website);

  const [c] = await db
    .insert(company)
    .values({ organizationId, name: cleanName, website: site })
    .returning({ id: company.id });

  // Best-effort: study the website and draft a description.
  const description = await generateCompanyDescription(cleanName, site);
  if (description) {
    await db
      .update(company)
      .set({ descriptionMd: description })
      .where(eq(company.id, c.id));
  }

  revalidatePath("/app");
  return { id: c.id, generated: Boolean(description) };
}

export async function updateCompany(
  id: string,
  data: { name?: string; website?: string | null; descriptionMd?: string },
) {
  const { user } = await requireUserAndOrg();
  const owned = await getOwnedCompany(id, user.id);
  if (!owned) throw new Error("Компания не найдена");

  const patch: Partial<typeof company.$inferInsert> = {};
  if (data.name !== undefined) {
    patch.name = data.name.trim().slice(0, 120) || owned.name;
  }
  if (data.website !== undefined) patch.website = cleanWebsite(data.website);
  if (data.descriptionMd !== undefined) {
    patch.descriptionMd = data.descriptionMd.trim() || null;
  }

  await db.update(company).set(patch).where(eq(company.id, id));
  revalidatePath("/app");
}

export async function regenerateCompanyDescription(id: string) {
  const { user } = await requireUserAndOrg();
  const owned = await getOwnedCompany(id, user.id);
  if (!owned) throw new Error("Компания не найдена");

  const description = await generateCompanyDescription(owned.name, owned.website);
  if (description) {
    await db
      .update(company)
      .set({ descriptionMd: description })
      .where(eq(company.id, id));
  }
  revalidatePath("/app");
  return { ok: Boolean(description), description };
}

export async function deleteCompany(id: string) {
  const { user } = await requireUserAndOrg();
  const owned = await getOwnedCompany(id, user.id);
  if (!owned) throw new Error("Компания не найдена");
  await db.delete(company).where(eq(company.id, id));
  revalidatePath("/app");
  redirect("/app");
}
