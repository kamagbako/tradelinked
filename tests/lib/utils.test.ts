import { describe, expect, it } from "vitest";
import { cn, formatCurrency, formatDate, maskAccountNumber } from "@/lib/utils";

describe("cn", () => {
  it("merges conflicting tailwind classes, last one wins", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("keeps non-conflicting classes", () => {
    expect(cn("px-2", "py-4")).toBe("px-2 py-4");
  });

  it("drops falsy values", () => {
    expect(cn("a", false, null, undefined, 0, "", "b")).toBe("a b");
  });

  it("supports conditional object syntax", () => {
    expect(cn("base", { active: true, disabled: false })).toBe("base active");
  });

  it("flattens arrays", () => {
    expect(cn(["a", ["b", "c"]], "d")).toBe("a b c d");
  });

  it("returns an empty string with no input", () => {
    expect(cn()).toBe("");
  });
});

describe("formatCurrency", () => {
  it("formats USD with thousands separators and two decimals", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("formats negative amounts", () => {
    expect(formatCurrency(-42.1)).toBe("-$42.10");
  });

  it("rounds to two decimals", () => {
    expect(formatCurrency(1.005 + 0.001)).toBe("$1.01");
    expect(formatCurrency(2.344)).toBe("$2.34");
    expect(formatCurrency(2.346)).toBe("$2.35");
  });

  it("always shows at least two fraction digits for whole numbers", () => {
    expect(formatCurrency(100)).toBe("$100.00");
  });

  it("formats large numbers", () => {
    expect(formatCurrency(1_000_000)).toBe("$1,000,000.00");
  });

  it("supports other currencies", () => {
    expect(formatCurrency(10, "EUR")).toBe("€10.00");
    expect(formatCurrency(10, "GBP")).toBe("£10.00");
  });

  it("throws on an invalid currency code", () => {
    expect(() => formatCurrency(1, "not-a-currency")).toThrow(RangeError);
  });
});

describe("formatDate", () => {
  it("formats a Date with medium date and short time", () => {
    const date = new Date(2024, 0, 5, 14, 30);
    const out = formatDate(date);
    expect(out).toContain("Jan 5, 2024");
    expect(out).toMatch(/2:30\sPM/);
  });

  it("accepts an ISO string", () => {
    const date = new Date(2023, 10, 20, 9, 5);
    expect(formatDate(date.toISOString())).toMatch(/^Nov 20, 2023.*9:05\sAM$/);
  });

  it("gives the same result for Date and equivalent string input", () => {
    const date = new Date(2022, 5, 15, 18, 45);
    expect(formatDate(date)).toBe(formatDate(date.toISOString()));
  });

  it("throws RangeError for an invalid date", () => {
    expect(() => formatDate("not a date")).toThrow(RangeError);
  });
});

describe("maskAccountNumber", () => {
  it("shows only the last four characters", () => {
    expect(maskAccountNumber("1234567890")).toBe("•••• 7890");
  });

  it("returns short values unchanged", () => {
    expect(maskAccountNumber("1234")).toBe("1234");
    expect(maskAccountNumber("12")).toBe("12");
    expect(maskAccountNumber("")).toBe("");
  });

  it("masks a five-character value", () => {
    expect(maskAccountNumber("12345")).toBe("•••• 2345");
  });
});
