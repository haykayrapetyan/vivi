import { describe, it, expect } from "vitest";
import {
  currencySymbol,
  formatDuration,
  formatSalary,
  symbolizeCurrencyText,
} from "@/lib/format";

describe("currencySymbol", () => {
  it("maps codes and symbols", () => {
    expect(currencySymbol("USD")).toBe("$");
    expect(currencySymbol("$")).toBe("$");
    expect(currencySymbol("eur")).toBe("€");
    expect(currencySymbol("GBP")).toBe("£");
    expect(currencySymbol("PLN")).toBe("PLN");
    expect(currencySymbol(undefined)).toBe("");
  });

  it("maps spelled-out and localized currency words to symbols", () => {
    expect(currencySymbol("dollars")).toBe("$");
    expect(currencySymbol("долларов")).toBe("$");
    expect(currencySymbol("евро")).toBe("€");
  });
});

describe("symbolizeCurrencyText", () => {
  it("swaps currency words inside free text for the symbol", () => {
    expect(symbolizeCurrencyText("7000 долларов")).toBe("7000 $");
    expect(symbolizeCurrencyText("up to 5000 dollars")).toBe("up to 5000 $");
    expect(symbolizeCurrencyText("300-400k")).toBe("300-400k");
  });
});

describe("formatSalary", () => {
  it("formats a min–max range with currency symbol and period", () => {
    expect(
      formatSalary({
        salaryMin: 3000,
        salaryMax: 4000,
        salaryCurrency: "USD",
        salaryPeriod: "month",
      }),
    ).toBe("3,000–4,000 $/mo");
  });

  it("handles min-only and max-only", () => {
    expect(
      formatSalary({ salaryMin: 120000, salaryCurrency: "USD", salaryPeriod: "year" }),
    ).toBe("from 120,000 $/yr");
    expect(
      formatSalary({ salaryMax: 50, salaryCurrency: "EUR", salaryPeriod: "hour" }),
    ).toBe("up to 50 €/hr");
  });

  it("falls back to legacy salaryRange and null", () => {
    expect(formatSalary({ salaryRange: "competitive" })).toBe("competitive");
    expect(formatSalary({ salaryRange: "7000 долларов" })).toBe("7000 $");
    expect(formatSalary({})).toBeNull();
  });

  it("uses the currency code when no symbol is known", () => {
    expect(
      formatSalary({ salaryMin: 100, salaryMax: 200, salaryCurrency: "PLN" }),
    ).toBe("100–200 PLN");
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
