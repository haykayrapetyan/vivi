import { NextResponse, after } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { candidate, interviewAnswer, interviewQuestion } from "@/lib/db/schema";
import { getCandidateByToken, getVacancyById } from "@/lib/data";
import { isAcceptingCandidates } from "@/lib/vacancy-lifecycle";
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

  const vac = await getVacancyById(cand.vacancyId);
  if (!vac || !isAcceptingCandidates(vac.status)) {
    return NextResponse.json(
      { error: "This vacancy is no longer accepting interviews" },
      { status: 410 },
    );
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

  // Upsert: one answer per (candidate, question).
  await db
    .delete(interviewAnswer)
    .where(
      and(
        eq(interviewAnswer.candidateId, cand.id),
        eq(interviewAnswer.questionId, questionId),
      ),
    );
  const [row] = await db
    .insert(interviewAnswer)
    .values({
      candidateId: cand.id,
      questionId,
      videoPath: key,
      mimeType,
      durationSec,
    })
    .returning({ id: interviewAnswer.id });

  if (cand.status === "applied") {
    await db
      .update(candidate)
      .set({ status: "interviewing" })
      .where(eq(candidate.id, cand.id));
  }

  // Whisper takes 5–20s per clip — run it AFTER the response so the candidate
  // moves to the next question instantly. If this doesn't finish (crash,
  // timeout), evaluation at completion backfills missing transcripts anyway.
  after(async () => {
    try {
      const transcript = await transcribeBuffer(buffer);
      if (transcript) {
        await db
          .update(interviewAnswer)
          .set({ transcript })
          .where(eq(interviewAnswer.id, row.id));
      }
    } catch (e) {
      console.error("[answer] background transcription failed:", e);
    }
  });

  return NextResponse.json({ ok: true });
}
