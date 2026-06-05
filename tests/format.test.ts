import { describe, it, expect } from "vitest";
import { formatDuration, pluralRu } from "@/lib/format";

const q: [string, string, string] = ["вопрос", "вопроса", "вопросов"];

describe("pluralRu", () => {
  it("picks the singular form", () => {
    expect(pluralRu(1, q)).toBe("вопрос");
    expect(pluralRu(21, q)).toBe("вопрос");
    expect(pluralRu(101, q)).toBe("вопрос");
  });

  it("picks the 'few' form for 2-4", () => {
    expect(pluralRu(2, q)).toBe("вопроса");
    expect(pluralRu(3, q)).toBe("вопроса");
    expect(pluralRu(24, q)).toBe("вопроса");
  });

  it("picks the 'many' form including teens and 0", () => {
    expect(pluralRu(0, q)).toBe("вопросов");
    expect(pluralRu(5, q)).toBe("вопросов");
    expect(pluralRu(11, q)).toBe("вопросов");
    expect(pluralRu(12, q)).toBe("вопросов");
    expect(pluralRu(14, q)).toBe("вопросов");
    expect(pluralRu(100, q)).toBe("вопросов");
  });
});

describe("formatDuration", () => {
  it("formats seconds as m:ss", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(5)).toBe("0:05");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(600)).toBe("10:00");
  });

  it("clamps negatives and floors fractions", () => {
    expect(formatDuration(-3)).toBe("0:00");
    expect(formatDuration(9.9)).toBe("0:09");
  });
});
