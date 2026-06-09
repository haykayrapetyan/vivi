import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

const { sendMock, presignMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  presignMock: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send = sendMock;
  },
  PutObjectCommand: class {
    constructor(public input: Record<string, unknown>) {}
  },
  GetObjectCommand: class {
    constructor(public input: Record<string, unknown>) {}
  },
  HeadObjectCommand: class {
    constructor(public input: Record<string, unknown>) {}
  },
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: presignMock }));

import { saveVideo, readVideo, getReadUrl, sanitizeKey } from "@/lib/storage";

beforeEach(() => {
  sendMock.mockReset();
  presignMock.mockReset();
  vi.stubEnv("R2_ACCOUNT_ID", "acc");
  vi.stubEnv("R2_ACCESS_KEY_ID", "key");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret");
  vi.stubEnv("R2_BUCKET", "bucket");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sanitizeKey", () => {
  it("strips path-traversal and leading slashes", () => {
    expect(sanitizeKey("../../etc/passwd")).toBe("etc/passwd");
    expect(sanitizeKey("/answers/c/q.webm")).toBe("answers/c/q.webm");
    expect(sanitizeKey("answers/c/q.webm")).toBe("answers/c/q.webm");
  });
});

describe("storage (R2)", () => {
  it("uploads with a sanitized key + content type", async () => {
    await saveVideo("answers/cand1/q1.webm", Buffer.from("x"), "video/mp4");
    expect(sendMock).toHaveBeenCalledTimes(1);
    const cmd = sendMock.mock.calls[0][0] as { input: Record<string, unknown> };
    expect(cmd.input.Key).toBe("answers/cand1/q1.webm");
    expect(cmd.input.ContentType).toBe("video/mp4");
    expect(cmd.input.Bucket).toBe("bucket");
  });

  it("reads object bytes", async () => {
    sendMock.mockResolvedValue({
      Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
    });
    const buf = await readVideo("answers/c/q.webm");
    expect(buf.equals(Buffer.from([1, 2, 3]))).toBe(true);
  });

  it("returns a signed read URL", async () => {
    presignMock.mockResolvedValue("https://signed.example/clip");
    expect(await getReadUrl("answers/c/q.webm")).toBe(
      "https://signed.example/clip",
    );
  });
});
