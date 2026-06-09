import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { candidate, user, vacancy } from "@/lib/db/schema";
import { getCandidateByToken } from "@/lib/data";
import { sendInterviewCompletedEmail } from "@/lib/email";
import { evaluateCandidate } from "@/lib/ai-eval";

export const maxDuration = 120;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const cand = await getCandidateByToken(token);
  if (!cand) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db
    .update(candidate)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(candidate.id, cand.id));

  // Generate the AI evaluation from the answer transcripts (best-effort).
  try {
    await evaluateCandidate(cand.id);
  } catch (e) {
    console.error("[complete] evaluation failed:", e);
  }

  // Notify the recruiter (best-effort).
  try {
    const [row] = await db
      .select({
        vacancyId: vacancy.id,
        vacancyTitle: vacancy.title,
        recruiterEmail: user.email,
      })
      .from(vacancy)
      .innerJoin(user, eq(vacancy.userId, user.id))
      .where(eq(vacancy.id, cand.vacancyId))
      .limit(1);

    if (row) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      await sendInterviewCompletedEmail(row.recruiterEmail, {
        candidateName: cand.name,
        vacancyTitle: row.vacancyTitle,
        url: `${appUrl}/app/v/${row.vacancyId}`,
      });
    }
  } catch (e) {
    console.error("[complete] notify failed:", e);
  }

  return NextResponse.json({ ok: true });
}
