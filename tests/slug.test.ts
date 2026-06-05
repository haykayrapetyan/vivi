import { describe, it, expect } from "vitest";
import { slugify, buildPublicSlug } from "@/lib/slug";

describe("slugify", () => {
  it("transliterates Russian and lowercases", () => {
    expect(slugify("Senior Frontend разработчик")).toBe(
      "senior-frontend-razrabotchik",
    );
  });

  it("collapses non-alphanumerics into single dashes and trims", () => {
    expect(slugify("  Hello,  World!!  ")).toBe("hello-world");
  });

  it("falls back to 'vacancy' for empty/symbol-only input", () => {
    expect(slugify("")).toBe("vacancy");
    expect(slugify("!!! ??? ")).toBe("vacancy");
  });

  it("caps the base length at 48 chars", () => {
    const long = "a".repeat(100);
    expect(slugify(long).length).toBe(48);
  });
});

describe("buildPublicSlug", () => {
  it("appends a 6-char random suffix", () => {
    const slug = buildPublicSlug("Менеджер по продажам");
    expect(slug).toMatch(/^menedzher-po-prodazham-[a-z0-9]{6}$/);
  });

  it("produces unique slugs for the same title", () => {
    const a = buildPublicSlug("Дизайнер");
    const b = buildPublicSlug("Дизайнер");
    expect(a).not.toBe(b);
  });
});
