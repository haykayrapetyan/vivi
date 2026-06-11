"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { requireUser } from "@/lib/session";
import { saveObject } from "@/lib/storage";
import { avatarKey, avatarUrl } from "@/lib/avatar";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export async function updateUserTheme(theme: "light" | "dark") {
  const u = await requireUser();
  if (theme !== "light" && theme !== "dark") return;
  await db.update(user).set({ theme }).where(eq(user.id, u.id));
}

/** Uploads a profile avatar (multipart form, field "file") to R2 and points the
 * user's image at the public avatar route. Returns the new image URL. */
export async function uploadUserAvatar(formData: FormData) {
  const u = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    throw new Error("Choose an image file");
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error("Image must be under 2 MB");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("Avatar must be an image");
  }

  const buf = Buffer.from(await file.arrayBuffer());
  await saveObject(avatarKey(u.id), buf, file.type);
  const image = avatarUrl(u.id);
  await db.update(user).set({ image }).where(eq(user.id, u.id));
  revalidatePath("/app");
  return { image };
}
