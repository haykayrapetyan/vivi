import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { candidate, member, vacancy } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { getReadUrl } from "@/lib/storage";

// Candidate avatar (a frame from their interview video). Org-member-only,
// same access rule as answer videos.
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
    .select({ avatarKey: candidate.avatarKey })
    .from(candidate)
    .innerJoin(vacancy, eq(candidate.vacancyId, vacancy.id))
    .innerJoin(member, eq(member.organizationId, vacancy.organizationId))
    .where(and(eq(candidate.id, id), eq(member.userId, session.user.id)))
    .limit(1);

  if (!row?.avatarKey) {
    return new Response("Not found", { status: 404 });
  }

  const url = await getReadUrl(row.avatarKey);
  return Response.redirect(url, 302);
}
