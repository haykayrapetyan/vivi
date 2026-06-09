import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { member } from "@/lib/db/schema";

export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export async function requireUser() {
  const s = await getSession();
  if (!s?.user) redirect("/login");
  return s.user;
}

/** The active organization id (from session, falling back to first membership). */
export async function getActiveOrganizationId(): Promise<string | null> {
  const s = await getSession();
  if (!s?.user) return null;
  const active =
    (s.session as { activeOrganizationId?: string | null })
      .activeOrganizationId ?? null;
  if (active) return active;
  const [m] = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, s.user.id))
    .limit(1);
  return m?.organizationId ?? null;
}

export async function requireUserAndOrg() {
  const user = await requireUser();
  const organizationId = await getActiveOrganizationId();
  if (!organizationId) {
    throw new Error("No active organization for user");
  }
  return { user, organizationId };
}
