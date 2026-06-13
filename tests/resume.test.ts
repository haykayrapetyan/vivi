import { describe, it, expect, vi, beforeEach } from "vitest";

const { readObjectMock, safeFetchMock } = vi.hoisted(() => ({
  readObjectMock: vi.fn(),
  safeFetchMock: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({ readObject: readObjectMock }));
vi.mock("@/lib/safe-fetch", () => ({ safeFetch: safeFetchMock }));

import { getResumeText } from "@/lib/resume";

beforeEach(() => {
  readObjectMock.mockReset();
  safeFetchMock.mockReset();
});

describe("getResumeText", () => {
  it("returns null when the candidate provided nothing", async () => {
    const out = await getResumeText({ resumeKey: null, resumeUrl: null });
    expect(out).toBeNull();
    expect(readObjectMock).not.toHaveBeenCalled();
    expect(safeFetchMock).not.toHaveBeenCalled();
  });

  it("reads an uploaded .txt file as plain text", async () => {
    readObjectMock.mockResolvedValue({
      body: Buffer.from("Jane Doe — 6 years backend", "utf8"),
      contentType: "text/plain",
    });
    const out = await getResumeText({
      resumeKey: "candidate-resumes/abc.txt",
      resumeUrl: null,
    });
    expect(out).toContain("Jane Doe");
    expect(readObjectMock).toHaveBeenCalledWith("candidate-resumes/abc.txt");
  });

  it("skips unparseable legacy .doc files", async () => {
    readObjectMock.mockResolvedValue({
      body: Buffer.from([0xd0, 0xcf, 0x11, 0xe0]),
      contentType: "application/msword",
    });
    const out = await getResumeText({
      resumeKey: "candidate-resumes/abc.doc",
      resumeUrl: null,
    });
    expect(out).toBeNull();
  });

  it("fetches and strips an HTML résumé link", async () => {
    safeFetchMock.mockResolvedValue({
      ok: true,
      headers: { get: () => "text/html; charset=utf-8" },
      text: async () => "<html><body><h1>Resume</h1><p>Senior dev</p></body></html>",
    });
    const out = await getResumeText({
      resumeKey: null,
      resumeUrl: "https://example.com/cv",
    });
    expect(out).toContain("Resume");
    expect(out).toContain("Senior dev");
    expect(out).not.toContain("<");
  });

  it("returns null when a link is unreachable or blocked", async () => {
    safeFetchMock.mockResolvedValue(null);
    const out = await getResumeText({
      resumeKey: null,
      resumeUrl: "https://blocked.example",
    });
    expect(out).toBeNull();
  });

  it("combines file and link when both are present", async () => {
    readObjectMock.mockResolvedValue({
      body: Buffer.from("From file", "utf8"),
      contentType: "text/plain",
    });
    safeFetchMock.mockResolvedValue({
      ok: true,
      headers: { get: () => "text/html" },
      text: async () => "<p>From link</p>",
    });
    const out = await getResumeText({
      resumeKey: "candidate-resumes/x.txt",
      resumeUrl: "https://example.com/cv",
    });
    expect(out).toContain("From file");
    expect(out).toContain("From link");
  });
});
