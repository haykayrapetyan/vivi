"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { group } from "@/lib/db/schema";
import { requireUserAndOrg } from "@/lib/session";
import { getOwnedGroup } from "@/lib/data";

// A "group" is an optional, name-only grouping of vacancies inside a company.

export async function createGroup(name: string) {
  const { organizationId } = await requireUserAndOrg();
  await db
    .insert(group)
    .values({ organizationId, name: name.trim().slice(0, 80) || "Group" });
  revalidatePath("/app");
}

export async function renameGroup(id: string, name: string) {
  const { user } = await requireUserAndOrg();
  const owned = await getOwnedGroup(id, user.id);
  if (!owned) throw new Error("Group not found");
  await db
    .update(group)
    .set({ name: name.trim().slice(0, 80) || owned.name })
    .where(eq(group.id, id));
  revalidatePath("/app");
}

export async function deleteGroup(id: string) {
  const { user } = await requireUserAndOrg();
  const owned = await getOwnedGroup(id, user.id);
  if (!owned) throw new Error("Group not found");
  // Vacancies in this group keep existing; their group_id is set to null.
  await db.delete(group).where(eq(group.id, id));
  revalidatePath("/app");
}
