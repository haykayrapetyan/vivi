import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  candidate,
  interviewAnswer,
  member,
  vacancy,
} from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { getReadUrl } from "@/lib/storage";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [row] = await db
    .select({ videoPath: interviewAnswer.videoPath })
    .from(interviewAnswer)
    .innerJoin(candidate, eq(interviewAnswer.candidateId, candidate.id))
    .innerJoin(vacancy, eq(candidate.vacancyId, vacancy.id))
    .innerJoin(member, eq(member.organizationId, vacancy.organizationId))
    .where(and(eq(interviewAnswer.id, id), eq(member.userId, session.user.id)))
    .limit(1);

  if (!row) {
    return new Response("Not found", { status: 404 });
  }

  const url = await getReadUrl(row.videoPath);
  return Response.redirect(url, 302);
}
