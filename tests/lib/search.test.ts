import { describe, expect, it } from "vitest";
import { sanitizeSearchTerm } from "@/lib/search";

describe("sanitizeSearchTerm", () => {
  it("leaves ordinary names and emails alone", () => {
    expect(sanitizeSearchTerm("Ada Lovelace")).toBe("Ada Lovelace");
    expect(sanitizeSearchTerm("ada@example.com")).toBe("ada@example.com");
  });

  it("returns an empty string for null, undefined and blank input", () => {
    expect(sanitizeSearchTerm(undefined)).toBe("");
    expect(sanitizeSearchTerm(null)).toBe("");
    expect(sanitizeSearchTerm("   ")).toBe("");
  });

  it("removes the characters that delimit PostgREST filter clauses", () => {
    const out = sanitizeSearchTerm("a,role.eq.ADMIN)");
    expect(out).not.toMatch(/[,()]/);
    expect(out).toBe("a role.eq.ADMIN");
  });

  it("strips wildcards, quotes, backslashes and backticks", () => {
    expect(sanitizeSearchTerm(`50%_off*"x"\\'y'\`z\``)).not.toMatch(/[%_*"'\\`]/);
  });

  it("collapses whitespace and trims", () => {
    expect(sanitizeSearchTerm("  a   b \n c  ")).toBe("a b c");
  });

  it("caps very long input", () => {
    expect(sanitizeSearchTerm("x".repeat(500))).toHaveLength(100);
  });
});
