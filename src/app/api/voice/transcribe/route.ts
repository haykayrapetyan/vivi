import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { transcribeBuffer } from "@/lib/ai-eval";

export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024; // OpenAI's audio upload limit

// Transcribes a short audio clip dictated in the app (e.g. the chat composer).
// Auth-gated — any logged-in user; the audio is not stored.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Voice input is unavailable (no OPENAI_API_KEY)" },
      { status: 503 },
    );
  }

  const form = await req.formData();
  const file = form.get("audio");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "No audio" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Audio too large" }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const text = await transcribeBuffer(buffer);
  if (!text) {
    return NextResponse.json(
      { error: "Couldn't transcribe the audio" },
      { status: 422 },
    );
  }
  return NextResponse.json({ text });
}
