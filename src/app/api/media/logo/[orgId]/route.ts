import { readObject } from "@/lib/storage";
import { logoKey } from "@/lib/logo";

// Company logos are public by design (shown on public vacancy/company pages),
// so this route is unauthenticated. It proxies the bytes (instead of
// redirecting to a signed URL, which changes every request and is never
// cached) with a long immutable cache — the stored logo URL carries a `?v=`
// buster that changes on re-upload, so stale copies are impossible.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const key = logoKey(orgId.replace(/[^a-zA-Z0-9_-]/g, ""));
  try {
    const { body, contentType } = await readObject(key);
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": contentType || "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
