import { describe, it, expect } from "vitest";
import { isEmail } from "@/lib/validation";

describe("isEmail", () => {
  it("accepts valid addresses", () => {
    expect(isEmail("you@email.com")).toBe(true);
    expect(isEmail("a.b-c+tag@sub.example.co")).toBe(true);
    expect(isEmail("  trimmed@example.com  ")).toBe(true);
  });

  it("rejects invalid addresses", () => {
    expect(isEmail("")).toBe(false);
    expect(isEmail("no-at")).toBe(false);
    expect(isEmail("missing@domain")).toBe(false);
    expect(isEmail("@nope.com")).toBe(false);
    expect(isEmail("spaces in@email.com")).toBe(false);
  });
});
