import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, LOCALES, LOCALE_COOKIE, NAMESPACES, isLocale } from "@/i18n/config";

describe("isLocale", () => {
  it.each(LOCALES.map((l) => l.code))("accepts %s", (code) => {
    expect(isLocale(code)).toBe(true);
  });

  it.each(["", "EN", "en-US", "xx", "english", " en"])("rejects %j", (value) => {
    expect(isLocale(value)).toBe(false);
  });

  it("rejects null and undefined", () => {
    expect(isLocale(null)).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe("i18n config", () => {
  it("default locale is English and is a supported locale", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(isLocale(DEFAULT_LOCALE)).toBe(true);
  });

  it("cookie name is NEXT_LOCALE", () => {
    expect(LOCALE_COOKIE).toBe("NEXT_LOCALE");
  });

  it("has unique locale codes", () => {
    const codes = LOCALES.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("every locale has a name and short label", () => {
    for (const l of LOCALES) {
      expect(l.name).toBeTruthy();
      expect(l.short).toBeTruthy();
    }
  });

  it("has a message file for every locale and namespace", () => {
    for (const { code } of LOCALES) {
      for (const ns of NAMESPACES) {
        expect(existsSync(path.join(process.cwd(), "src", "messages", code, `${ns}.json`)), `${code}/${ns}`).toBe(true);
      }
    }
  });
});
