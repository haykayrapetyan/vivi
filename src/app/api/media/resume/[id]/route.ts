import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { candidate, member, vacancy } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { getReadUrl } from "@/lib/storage";

// A candidate's uploaded resume file. Org-member-only, same access rule as
// answer videos. (Resume links live on the candidate row, not here.)
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
    .select({ resumeKey: candidate.resumeKey })
    .from(candidate)
    .innerJoin(vacancy, eq(candidate.vacancyId, vacancy.id))
    .innerJoin(member, eq(member.organizationId, vacancy.organizationId))
    .where(and(eq(candidate.id, id), eq(member.userId, session.user.id)))
    .limit(1);

  if (!row?.resumeKey) {
    return new Response("Not found", { status: 404 });
  }

  const url = await getReadUrl(row.resumeKey);
  return Response.redirect(url, 302);
}
