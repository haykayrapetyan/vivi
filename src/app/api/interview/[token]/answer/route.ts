import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { candidate, interviewAnswer, interviewQuestion } from "@/lib/db/schema";
import { getCandidateByToken } from "@/lib/data";
import { saveVideo } from "@/lib/storage";
import { transcribeBuffer } from "@/lib/ai-eval";

export const maxDuration = 60;

const MAX_BYTES = 80 * 1024 * 1024; // 80 MB per answer

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
  const questionId = String(form.get("questionId") ?? "");
  const durationSec = Number(form.get("durationSec") ?? 0) || null;
  const file = form.get("video");

  if (!questionId || !(file instanceof Blob)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }
  if (file.type && !file.type.startsWith("video/")) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 415 });
  }

  // Validate the question belongs to this candidate's vacancy.
  const [q] = await db
    .select({ id: interviewQuestion.id })
    .from(interviewQuestion)
    .where(
      and(
        eq(interviewQuestion.id, questionId),
        eq(interviewQuestion.vacancyId, cand.vacancyId),
      ),
    )
    .limit(1);
  if (!q) {
    return NextResponse.json({ error: "Unknown question" }, { status: 400 });
  }

  const mimeType = file.type || "video/webm";
  const ext = mimeType.includes("mp4") ? "mp4" : "webm";
  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `answers/${cand.id}/${questionId}.${ext}`;
  await saveVideo(key, buffer, mimeType);

  // Transcribe now (best-effort) so evaluation at completion is fast.
  const transcript = await transcribeBuffer(buffer);

  // Upsert: one answer per (candidate, question).
  await db
    .delete(interviewAnswer)
    .where(
      and(
        eq(interviewAnswer.candidateId, cand.id),
        eq(interviewAnswer.questionId, questionId),
      ),
    );
  await db.insert(interviewAnswer).values({
    candidateId: cand.id,
    questionId,
    videoPath: key,
    mimeType,
    durationSec,
    transcript,
  });

  if (cand.status === "applied") {
    await db
      .update(candidate)
      .set({ status: "interviewing" })
      .where(eq(candidate.id, cand.id));
  }

  return NextResponse.json({ ok: true });
}
