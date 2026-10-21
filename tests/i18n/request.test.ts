import { beforeEach, describe, expect, it, vi } from "vitest";
import { flatten, loadMessages } from "@tests/helpers/messages";

const { cookiesMock, headersMock, cookieGetMock, headerGetMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  headersMock: vi.fn(),
  cookieGetMock: vi.fn(),
  headerGetMock: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: cookiesMock, headers: headersMock }));
// Return the config factory itself so the test can invoke it directly.
vi.mock("next-intl/server", () => ({ getRequestConfig: (fn: unknown) => fn }));

// A deliberately partial German translation to exercise the English fallback merge.
vi.mock("@/messages/de/auth.json", () => ({
  default: { errors: { credentialsRequired: "MOCK-DE required" } },
}));
vi.mock("@/messages/de/landing.json", () => {
  throw new Error("namespace not translated yet");
});

import requestConfig from "@/i18n/request";

type Config = { locale: string; messages: Record<string, unknown> };
const getConfig = requestConfig as unknown as () => Promise<Config>;

function setRequest({ cookie, acceptLanguage }: { cookie?: string; acceptLanguage?: string | null }) {
  cookieGetMock.mockImplementation((name: string) =>
    name === "NEXT_LOCALE" && cookie !== undefined ? { name, value: cookie } : undefined,
  );
  headerGetMock.mockImplementation((name: string) => (name === "accept-language" ? (acceptLanguage ?? null) : null));
}

beforeEach(() => {
  cookiesMock.mockResolvedValue({ get: cookieGetMock });
  headersMock.mockResolvedValue({ get: headerGetMock });
  setRequest({});
});

describe("locale detection", () => {
  it("uses English when there is no cookie and no Accept-Language", async () => {
    expect((await getConfig()).locale).toBe("en");
  });

  it("uses a saved supported cookie", async () => {
    setRequest({ cookie: "es" });
    expect((await getConfig()).locale).toBe("es");
  });

  it("saved cookie wins over Accept-Language", async () => {
    setRequest({ cookie: "pt", acceptLanguage: "fr-FR,fr;q=0.9" });
    expect((await getConfig()).locale).toBe("pt");
    expect(headerGetMock).not.toHaveBeenCalled();
  });

  it("ignores an unsupported cookie and falls back to Accept-Language", async () => {
    setRequest({ cookie: "xx", acceptLanguage: "fr" });
    expect((await getConfig()).locale).toBe("fr");
  });

  it("maps a regional tag to its base language (fr-FR -> fr)", async () => {
    setRequest({ acceptLanguage: "fr-FR" });
    expect((await getConfig()).locale).toBe("fr");
  });

  it("is case-insensitive (PT-br -> pt)", async () => {
    setRequest({ acceptLanguage: "PT-br" });
    expect((await getConfig()).locale).toBe("pt");
  });

  it("picks the first supported entry, skipping unsupported ones and ignoring q-values", async () => {
    setRequest({ acceptLanguage: "ja-JP,ja;q=0.9,de;q=0.8,fr;q=0.7" });
    expect((await getConfig()).locale).toBe("de");
  });

  it("uses list order rather than q-values", async () => {
    setRequest({ acceptLanguage: "es;q=0.1,fr;q=0.9" });
    expect((await getConfig()).locale).toBe("es");
  });

  it("handles whitespace around entries", async () => {
    setRequest({ acceptLanguage: "ja , zh-CN;q=0.8" });
    expect((await getConfig()).locale).toBe("zh");
  });

  it("falls back to English for unknown languages", async () => {
    setRequest({ acceptLanguage: "ja-JP,ko;q=0.9" });
    expect((await getConfig()).locale).toBe("en");
  });

  it("falls back to English for a wildcard or empty header", async () => {
    setRequest({ acceptLanguage: "*" });
    expect((await getConfig()).locale).toBe("en");
    setRequest({ acceptLanguage: "" });
    expect((await getConfig()).locale).toBe("en");
  });
});

describe("messages", () => {
  it("returns the real English messages for English", async () => {
    const { messages } = await getConfig();
    expect(messages).toEqual(loadMessages("en"));
  });

  it("returns all namespaces", async () => {
    const { messages } = await getConfig();
    expect(Object.keys(messages).sort()).toEqual(["auth", "common", "dashboard", "landing"]);
  });

  it("uses translated strings for a fully translated locale", async () => {
    setRequest({ cookie: "fr" });
    const { messages } = await getConfig();
    const flat = flatten(messages as never);
    const fr = flatten(loadMessages("fr"));
    const en = flatten(loadMessages("en"));
    expect(flat["common.errors.unexpected"]).toBe(fr["common.errors.unexpected"]);
    expect(flat["common.errors.unexpected"]).not.toBe(en["common.errors.unexpected"]);
  });

  it("never loses an English key: every English key exists for every locale", async () => {
    const en = Object.keys(flatten(loadMessages("en")));
    for (const locale of ["fr", "es", "pt", "de", "zh"]) {
      setRequest({ cookie: locale });
      const flat = flatten((await getConfig()).messages as never);
      for (const key of en) expect(flat, `${locale}:${key}`).toHaveProperty(key);
    }
  });

  it("merges a partial translation: translated keys win, missing keys fall back to English", async () => {
    setRequest({ cookie: "de" });
    const flat = flatten((await getConfig()).messages as never);
    const en = flatten(loadMessages("en"));
    expect(flat["auth.errors.credentialsRequired"]).toBe("MOCK-DE required");
    expect(flat["auth.errors.invalidEmail"]).toBe(en["auth.errors.invalidEmail"]);
  });

  it("falls back to English for a namespace that fails to load", async () => {
    setRequest({ cookie: "de" });
    const flat = flatten((await getConfig()).messages as never);
    const en = flatten(loadMessages("en"));
    const landingKeys = Object.keys(en).filter((k) => k.startsWith("landing."));
    expect(landingKeys.length).toBeGreaterThan(0);
    for (const key of landingKeys) expect(flat[key]).toBe(en[key]);
  });

  it("does not mutate or leak German strings into a later English request", async () => {
    setRequest({ cookie: "de" });
    await getConfig();
    setRequest({});
    const flat = flatten((await getConfig()).messages as never);
    expect(flat["auth.errors.credentialsRequired"]).toBe("Email and password are required.");
  });
});
