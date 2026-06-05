import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { saveVideo, readVideo, videoSize, fullPath } from "@/lib/storage";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vivi-storage-"));
  // storage resolves relative to process.cwd(); point cwd at the tmp dir.
  vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
  vi.stubEnv("LOCAL_UPLOAD_DIR", "uploads");
  vi.stubEnv("STORAGE_DRIVER", "local");
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("storage (local)", () => {
  it("round-trips a saved video", async () => {
    const key = "answers/cand1/q1.webm";
    const data = Buffer.from("fake-video-bytes");
    const returnedKey = await saveVideo(key, data);
    expect(returnedKey).toBe(key);

    const read = await readVideo(key);
    expect(read.equals(data)).toBe(true);
    expect(await videoSize(key)).toBe(data.length);
  });

  it("prevents path traversal in keys", () => {
    const resolved = fullPath("../../etc/passwd");
    expect(resolved.startsWith(path.join(tmpDir, "uploads"))).toBe(true);
    expect(resolved).not.toContain("..");
  });

  it("rejects unimplemented drivers", async () => {
    vi.stubEnv("STORAGE_DRIVER", "r2");
    await expect(saveVideo("x.webm", Buffer.from("x"))).rejects.toThrow(
      /not implemented/,
    );
  });
});
