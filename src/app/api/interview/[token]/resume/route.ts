import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { candidate } from "@/lib/db/schema";
import { getCandidateByToken } from "@/lib/data";
import { saveObject } from "@/lib/storage";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// Allowed resume document types (plus a generic fallback for some browsers).
const ALLOWED = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

const EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "text/plain": "txt",
};

// The candidate's resume, collected right after they start the interview.
// Token-authed (same as the interview). Accepts a pasted link ("url") and/or
// an uploaded document ("file"). At least one is required.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const cand = await getCandidateByToken(token);
  if (!cand) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const form = await req.formData();
  const rawUrl = String(form.get("url") ?? "").trim();
  const file = form.get("file");

  const update: { resumeUrl?: string; resumeKey?: string } = {};

  if (rawUrl) {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return NextResponse.json({ error: "Invalid link" }, { status: 400 });
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json({ error: "Invalid link" }, { status: 400 });
    }
    update.resumeUrl = parsed.toString();
  }

  if (file instanceof Blob && file.size > 0) {
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large" }, { status: 413 });
    }
    const type = file.type || "application/pdf";
    if (!ALLOWED.includes(type)) {
      return NextResponse.json(
        { error: "Use a PDF, Word doc or text file" },
        { status: 415 },
      );
    }
    const key = `candidate-resumes/${cand.id}.${EXT[type] ?? "pdf"}`;
    await saveObject(key, Buffer.from(await file.arrayBuffer()), type);
    update.resumeKey = key;
  }

  if (!update.resumeUrl && !update.resumeKey) {
    return NextResponse.json(
      { error: "Add a link or upload a file" },
      { status: 400 },
    );
  }

  await db.update(candidate).set(update).where(eq(candidate.id, cand.id));
  return NextResponse.json({ ok: true });
}
