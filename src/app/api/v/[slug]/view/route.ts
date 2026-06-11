import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { vacancy } from "@/lib/db/schema";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  await db
    .update(vacancy)
    .set({ viewCount: sql`${vacancy.viewCount} + 1` })
    .where(and(eq(vacancy.publicSlug, slug), eq(vacancy.status, "published")));
  return NextResponse.json({ ok: true });
}
