import { getReadUrl, videoSize } from "@/lib/storage";
import { logoKey } from "@/lib/logo";

// Company logos are public by design (shown on public vacancy pages), so this
// route is unauthenticated: it 302-redirects to a short-lived signed R2 URL.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const key = logoKey(orgId.replace(/[^a-zA-Z0-9_-]/g, ""));
  try {
    await videoSize(key); // HEAD: throws when the object doesn't exist
    const url = await getReadUrl(key);
    return Response.redirect(url, 302);
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
