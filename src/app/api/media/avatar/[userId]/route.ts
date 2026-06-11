import { getReadUrl, videoSize } from "@/lib/storage";
import { avatarKey } from "@/lib/avatar";

// Avatars are shown across the app (sidebar, members, vacancy owner), so this
// route is unauthenticated: it 302-redirects to a short-lived signed R2 URL.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const key = avatarKey(userId.replace(/[^a-zA-Z0-9_-]/g, ""));
  try {
    await videoSize(key); // HEAD: throws when the object doesn't exist
    const url = await getReadUrl(key);
    return Response.redirect(url, 302);
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
