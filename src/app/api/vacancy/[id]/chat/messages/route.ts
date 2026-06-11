import { NextResponse } from "next/server";
import { and, asc, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatMessage } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { getOwnedVacancy } from "@/lib/data";

/**
 * Polling endpoint for autonomous agent messages: returns `source = 'auto'`
 * messages created after the given timestamp so the open chat can pick up
 * what the agent posted while the recruiter is looking at it.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const owned = await getOwnedVacancy(id, session.user.id);
  if (!owned) {
    return new Response("Not found", { status: 404 });
  }

  const afterParam = new URL(req.url).searchParams.get("after");
  const after = afterParam ? new Date(afterParam) : null;
  if (!after || Number.isNaN(after.getTime())) {
    return NextResponse.json({ error: "Invalid 'after'" }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(chatMessage)
    .where(
      and(
        eq(chatMessage.vacancyId, id),
        eq(chatMessage.source, "auto"),
        gt(chatMessage.createdAt, after),
      ),
    )
    .orderBy(asc(chatMessage.createdAt));

  return NextResponse.json({
    messages: rows.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}
