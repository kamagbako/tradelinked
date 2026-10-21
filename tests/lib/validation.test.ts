import { describe, expect, it } from "vitest";
import { PASSWORD_MIN_LENGTH, isStrongPassword, isValidEmail, passwordChecks } from "@/lib/validation";

describe("isValidEmail", () => {
  it.each(["a@b.co", "user@example.com", "first.last+tag@sub.domain.org", "  padded@example.com  "])(
    "accepts %s",
    (email) => {
      expect(isValidEmail(email)).toBe(true);
    },
  );

  it.each([
    "",
    "plain",
    "@example.com",
    "user@",
    "user@example",
    "user@example.c",
    "user @example.com",
    "user@exa mple.com",
    "a@@b.com",
  ])("rejects %j", (email) => {
    expect(isValidEmail(email)).toBe(false);
  });
});

describe("passwordChecks", () => {
  it("exposes the minimum length constant", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
  });

  it("returns the three checks in order with ids", () => {
    expect(passwordChecks("").map((c) => c.id)).toEqual(["length", "letter", "number"]);
  });

  it("labels mention the minimum length", () => {
    expect(passwordChecks("")[0].label).toBe("At least 8 characters");
  });

  it("marks nothing met for an empty password", () => {
    expect(passwordChecks("").every((c) => !c.met)).toBe(true);
  });

  it("evaluates each check independently", () => {
    const byId = (pw: string) => Object.fromEntries(passwordChecks(pw).map((c) => [c.id, c.met]));
    expect(byId("abcdefgh")).toEqual({ length: true, letter: true, number: false });
    expect(byId("12345678")).toEqual({ length: true, letter: false, number: true });
    expect(byId("a1")).toEqual({ length: false, letter: true, number: true });
    expect(byId("!!!!!!!!")).toEqual({ length: true, letter: false, number: false });
  });

  it("length boundary is inclusive at 8", () => {
    expect(passwordChecks("abcdefg1")[0].met).toBe(true);
    expect(passwordChecks("abcdef1")[0].met).toBe(false);
  });
});

describe("isStrongPassword", () => {
  it("accepts a password meeting all rules", () => {
    expect(isStrongPassword("abcdefg1")).toBe(true);
    expect(isStrongPassword("Correct-Horse-9")).toBe(true);
  });

  it("rejects short passwords", () => {
    expect(isStrongPassword("abc123")).toBe(false);
  });

  it("rejects passwords without a number", () => {
    expect(isStrongPassword("abcdefghij")).toBe(false);
  });

  it("rejects passwords without a letter", () => {
    expect(isStrongPassword("1234567890")).toBe(false);
  });

  it("rejects the empty string", () => {
    expect(isStrongPassword("")).toBe(false);
  });
});
