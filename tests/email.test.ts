import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

import { send } from "@/lib/email";

const args = {
  to: "someone@example.com",
  subject: "Hi",
  html: "<p>Hi</p>",
  text: "Hi",
};

beforeEach(() => {
  sendMock.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("email send", () => {
  it("logs (no throw) and skips Resend when no API key", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    await expect(send(args)).resolves.toBeUndefined();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("calls Resend with the from/to when a key is set", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "Vivi <test@vivi.dev>");
    sendMock.mockResolvedValue({ error: null });
    await send(args);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: args.to, from: "Vivi <test@vivi.dev>" }),
    );
  });

  it("swallows Resend errors in development", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("NODE_ENV", "development");
    sendMock.mockResolvedValue({ error: { message: "sandbox restriction" } });
    await expect(send(args)).resolves.toBeUndefined();
  });

  it("throws on Resend errors in production", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("NODE_ENV", "production");
    sendMock.mockResolvedValue({ error: { message: "boom" } });
    await expect(send(args)).rejects.toThrow(/boom/);
  });
});
