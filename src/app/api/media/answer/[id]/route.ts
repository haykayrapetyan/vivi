import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { candidate, interviewAnswer, vacancy } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { readVideo } from "@/lib/storage";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [row] = await db
    .select({
      videoPath: interviewAnswer.videoPath,
      mimeType: interviewAnswer.mimeType,
    })
    .from(interviewAnswer)
    .innerJoin(candidate, eq(interviewAnswer.candidateId, candidate.id))
    .innerJoin(vacancy, eq(candidate.vacancyId, vacancy.id))
    .where(and(eq(interviewAnswer.id, id), eq(vacancy.userId, session.user.id)))
    .limit(1);

  if (!row) {
    return new Response("Not found", { status: 404 });
  }

  let buffer: Buffer;
  try {
    buffer = await readVideo(row.videoPath);
  } catch {
    return new Response("File missing", { status: 404 });
  }

  const total = buffer.length;
  const range = req.headers.get("range");

  if (range) {
    const match = /bytes=(\d+)-(\d*)/.exec(range);
    const start = match ? parseInt(match[1], 10) : 0;
    const end = match && match[2] ? parseInt(match[2], 10) : total - 1;
    const chunk = buffer.subarray(start, end + 1);
    return new Response(new Uint8Array(chunk), {
      status: 206,
      headers: {
        "Content-Type": row.mimeType,
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunk.length),
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": row.mimeType,
      "Content-Length": String(total),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
