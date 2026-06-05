import "server-only";
import fs from "node:fs/promises";
import path from "node:path";

function driver() {
  return process.env.STORAGE_DRIVER ?? "local";
}

export function fullPath(key: string) {
  const root = process.env.LOCAL_UPLOAD_DIR ?? "./uploads";
  // Prevent path traversal — keys are app-generated, but be safe.
  const safe = key.replace(/\.\.+/g, "").replace(/^\/+/, "");
  return path.join(process.cwd(), root, safe);
}

export async function saveVideo(key: string, data: Buffer): Promise<string> {
  if (driver() !== "local") {
    throw new Error(`Storage driver "${driver()}" is not implemented yet`);
  }
  const full = fullPath(key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
  return key;
}

export async function readVideo(key: string): Promise<Buffer> {
  return fs.readFile(fullPath(key));
}

export async function videoSize(key: string): Promise<number> {
  const stat = await fs.stat(fullPath(key));
  return stat.size;
}
