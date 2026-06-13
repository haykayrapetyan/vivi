import { readObject } from "@/lib/storage";
import { avatarKey } from "@/lib/avatar";

// Avatars are shown across the app (sidebar, members, vacancy owner), so this
// route is unauthenticated. It proxies the bytes (instead of redirecting to a
// signed URL, which changes every request and is never cached) with a long
// immutable cache — the stored avatar URL carries a `?v=` buster that changes
// on re-upload, so stale copies are impossible.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const key = avatarKey(userId.replace(/[^a-zA-Z0-9_-]/g, ""));
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
