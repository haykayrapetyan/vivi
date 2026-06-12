import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { candidate } from "@/lib/db/schema";
import { getCandidateByToken } from "@/lib/data";
import { saveObject } from "@/lib/storage";

const MAX_BYTES = 2 * 1024 * 1024;

// Stores a still frame captured from the candidate's camera at the start of
// recording — used as their avatar across the app. Token-authed (same as the
// interview itself); written once per candidate.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const cand = await getCandidateByToken(token);
  if (!cand) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (cand.avatarKey) return NextResponse.json({ ok: true }); // already set

  const form = await req.formData();
  const file = form.get("image");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "No image" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Too large" }, { status: 413 });
  }
  if (file.type && !file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Invalid type" }, { status: 415 });
  }

  const key = `candidate-avatars/${cand.id}.jpg`;
  await saveObject(key, Buffer.from(await file.arrayBuffer()), "image/jpeg");
  await db
    .update(candidate)
    .set({ avatarKey: key })
    .where(eq(candidate.id, cand.id));
  return NextResponse.json({ ok: true });
}
