import "server-only";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import ffmpegStatic from "ffmpeg-static";

const run = promisify(execFile);

/**
 * Samples evenly-spaced still frames from a video buffer as JPEGs, so a vision
 * model can judge on-camera presence. Best-effort: returns [] if ffmpeg is
 * unavailable or extraction fails. Uses the bundled ffmpeg-static binary, so it
 * needs no system install in dev or prod.
 */
export async function extractFrames(
  buffer: Buffer,
  { count = 2 }: { count?: number } = {},
): Promise<Buffer[]> {
  if (!ffmpegStatic || count < 1) return [];

  let dir: string | null = null;
  try {
    dir = await mkdtemp(join(tmpdir(), "vivi-frames-"));
    const input = join(dir, "in");
    await writeFile(input, buffer);

    // thumbnail=N picks one representative frame per N-frame window; sampling a
    // handful across the clip is enough to read setting/engagement without
    // decoding the whole video.
    await run(ffmpegStatic, [
      "-i",
      input,
      "-vf",
      `thumbnail,fps=1`,
      "-frames:v",
      String(count),
      "-q:v",
      "5",
      join(dir, "frame-%02d.jpg"),
    ]);

    const frames: Buffer[] = [];
    for (let i = 1; i <= count; i++) {
      try {
        frames.push(
          await readFile(join(dir, `frame-${String(i).padStart(2, "0")}.jpg`)),
        );
      } catch {
        // Fewer frames than requested (short clip) — stop.
        break;
      }
    }
    return frames;
  } catch (e) {
    console.error("[video-frames] extraction failed:", e);
    return [];
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
