import { describe, expect, it } from "vitest";
import {
  canTransition,
  isAcceptingCandidates,
  isPubliclyVisible,
} from "@/lib/vacancy-lifecycle";

describe("canTransition", () => {
  it("allows the happy path of the lifecycle", () => {
    expect(canTransition("draft", "archived")).toBe(true);
    expect(canTransition("published", "closed")).toBe(true);
    expect(canTransition("closed", "published")).toBe(true); // reopen
    expect(canTransition("closed", "archived")).toBe(true);
    expect(canTransition("archived", "draft")).toBe(true); // restore
  });

  it("rejects nonsensical transitions", () => {
    expect(canTransition("draft", "published")).toBe(false); // publish has its own path
    expect(canTransition("draft", "closed")).toBe(false);
    expect(canTransition("archived", "published")).toBe(false);
    expect(canTransition("published", "draft")).toBe(false); // that's unpublish
    expect(canTransition("closed", "draft")).toBe(false);
  });

  it("never allows a no-op transition", () => {
    for (const s of ["draft", "published", "closed", "archived"] as const) {
      expect(canTransition(s, s)).toBe(false);
    }
  });
});

describe("isAcceptingCandidates", () => {
  it("is true only for published", () => {
    expect(isAcceptingCandidates("published")).toBe(true);
    expect(isAcceptingCandidates("draft")).toBe(false);
    expect(isAcceptingCandidates("closed")).toBe(false);
    expect(isAcceptingCandidates("archived")).toBe(false);
  });
});

describe("isPubliclyVisible", () => {
  it("shows published and closed, hides draft and archived", () => {
    expect(isPubliclyVisible("published")).toBe(true);
    expect(isPubliclyVisible("closed")).toBe(true); // shows a closed notice
    expect(isPubliclyVisible("draft")).toBe(false);
    expect(isPubliclyVisible("archived")).toBe(false);
  });
});
