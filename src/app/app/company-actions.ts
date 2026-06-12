"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { organization } from "@/lib/db/schema";
import { requireUserAndOrg } from "@/lib/session";
import { getOrganization } from "@/lib/data";
import { normalizeUrl } from "@/lib/company-ai";
import { fetchAndStoreLogo, logoKey, logoUrl } from "@/lib/logo";
import { saveObject } from "@/lib/storage";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

// A "company" is the active organization (workspace). These actions manage its
// profile: name, website, AI-generated description, and logo.

function cleanWebsite(website: string | null | undefined): string | null {
  if (!website || !website.trim()) return null;
  return normalizeUrl(website) ?? null;
}

export async function updateCompany(data: {
  name?: string;
  website?: string | null;
  descriptionMd?: string;
  logo?: string | null;
}) {
  const { organizationId } = await requireUserAndOrg();
  const org = await getOrganization(organizationId);
  if (!org) throw new Error("Company not found");

  const patch: Partial<typeof organization.$inferInsert> = {};
  if (data.name !== undefined) {
    patch.name = data.name.trim().slice(0, 120) || org.name;
  }
  if (data.website !== undefined) patch.website = cleanWebsite(data.website);
  if (data.descriptionMd !== undefined) {
    patch.descriptionMd = data.descriptionMd.trim() || null;
  }
  if (data.logo !== undefined) patch.logo = data.logo?.trim() || null;

  await db.update(organization).set(patch).where(eq(organization.id, organizationId));
  revalidatePath("/app");
}

/** Uploads a company logo (multipart form, field "file") to R2 and points the
 * active organization's logo at the public logo route. */
export async function uploadCompanyLogo(formData: FormData) {
  const { organizationId } = await requireUserAndOrg();
  const file = formData.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    throw new Error("Choose an image file");
  }
  if (file.size > MAX_LOGO_BYTES) {
    throw new Error("Logo must be under 2 MB");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("Logo must be an image");
  }

  const buf = Buffer.from(await file.arrayBuffer());
  await saveObject(logoKey(organizationId), buf, file.type);
  const logo = logoUrl(organizationId);
  await db
    .update(organization)
    .set({ logo })
    .where(eq(organization.id, organizationId));
  revalidatePath("/app");
  return { logo };
}

/** Called right after a new company (org) is created client-side: stores the
 * website and tries to discover the logo on the site when none was uploaded.
 * No AI description is generated — the recruiter writes a short optional one,
 * and the vacancy agent reads the live website when it builds a vacancy.
 * Operates on the active organization. */
export async function setupCompany(website: string | null) {
  const { organizationId } = await requireUserAndOrg();
  const org = await getOrganization(organizationId);
  if (!org) return;

  const site = cleanWebsite(website);
  const logo =
    !org.logo && site ? await fetchAndStoreLogo(organizationId, site) : null;

  await db
    .update(organization)
    .set({ website: site, ...(logo ? { logo } : {}) })
    .where(eq(organization.id, organizationId));
  revalidatePath("/app");
}
