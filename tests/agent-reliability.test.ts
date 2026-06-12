import { describe, expect, it } from "vitest";
import { pickUnscreened } from "@/lib/agent/stuck";
import { screenKey } from "@/lib/agent/keys";
import {
  mintSocketToken,
  verifySocketToken,
} from "@/lib/agent/socket-token";
import { buildAgentSystemPrompt } from "@/lib/agent/prompt";

describe("pickUnscreened (catch-up sweep)", () => {
  const pool = [
    { id: "a", completedAt: new Date("2026-06-01") },
    { id: "b", completedAt: null }, // not completed — never swept
    { id: "c", completedAt: new Date("2026-06-02") },
    { id: "d", completedAt: new Date("2026-06-03") },
  ];

  it("returns completed candidates missing from the ledger", () => {
    const out = pickUnscreened(pool, [screenKey("a")], screenKey);
    expect(out.map((c) => c.id)).toEqual(["c", "d"]);
  });

  it("returns nothing when the ledger covers everyone", () => {
    const done = [screenKey("a"), screenKey("c"), screenKey("d")];
    expect(pickUnscreened(pool, done, screenKey)).toEqual([]);
  });

  it("caps the sweep size to bound LLM cost", () => {
    const out = pickUnscreened(pool, [], screenKey, 2);
    expect(out).toHaveLength(2);
  });
});

describe("socket tokens", () => {
  const secret = "test-secret";

  it("round-trips for the right vacancy", async () => {
    const token = await mintSocketToken(secret, "vac-1");
    await expect(verifySocketToken(secret, "vac-1", token)).resolves.toBe(true);
  });

  it("rejects another vacancy, tampering, wrong secret and expiry", async () => {
    const token = await mintSocketToken(secret, "vac-1");
    await expect(verifySocketToken(secret, "vac-2", token)).resolves.toBe(false);
    await expect(
      verifySocketToken(secret, "vac-1", token.slice(0, -2) + "xx"),
    ).resolves.toBe(false);
    await expect(verifySocketToken("other", "vac-1", token)).resolves.toBe(false);

    const expired = await mintSocketToken(secret, "vac-1", Date.now() - 1000);
    await expect(verifySocketToken(secret, "vac-1", expired)).resolves.toBe(false);
    await expect(verifySocketToken(secret, "vac-1", null)).resolves.toBe(false);
    await expect(verifySocketToken(secret, "vac-1", "garbage")).resolves.toBe(false);
  });
});

describe("buildAgentSystemPrompt instructions section", () => {
  const base = { vacancyTitle: "T", vacancyStatus: "published" };

  it("mentions set_agent_instructions only in interactive chat", () => {
    expect(
      buildAgentSystemPrompt({ ...base, canManageInstructions: true }),
    ).toContain("set_agent_instructions");
    expect(buildAgentSystemPrompt(base)).not.toContain(
      "set_agent_instructions",
    );
  });
});
