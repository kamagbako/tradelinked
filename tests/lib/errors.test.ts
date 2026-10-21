import { beforeEach, describe, expect, it, vi } from "vitest";
import { RedirectSignal } from "@tests/helpers/supabase";

const { getTranslationsMock, logErrorMock } = vi.hoisted(() => ({
  getTranslationsMock: vi.fn(),
  logErrorMock: vi.fn(),
}));

vi.mock("next-intl/server", async () => {
  const real = (await import("@tests/helpers/utils")).nextIntlServerMock();
  getTranslationsMock.mockImplementation(real.getTranslations);
  return { ...real, getTranslations: getTranslationsMock };
});
vi.mock("@/lib/logger", () => ({ logError: logErrorMock, logWarn: vi.fn() }));

import { isFrameworkSignal, runAction } from "@/lib/errors";

beforeEach(async () => {
  const real = (await import("@tests/helpers/utils")).nextIntlServerMock();
  getTranslationsMock.mockImplementation(real.getTranslations);
});

describe("isFrameworkSignal", () => {
  it.each([
    "NEXT_REDIRECT;replace;/login;307;",
    "NEXT_NOT_FOUND",
    "NEXT_HTTP_ERROR_FALLBACK;404",
    "DYNAMIC_SERVER_USAGE",
    "BAILOUT_TO_CLIENT_SIDE_RENDERING",
  ])("recognises digest %s", (digest) => {
    expect(isFrameworkSignal({ digest })).toBe(true);
  });

  it.each(["NEXT_REDIRECT", "NEXT_NOT_FOUND", "NEXT_HTTP_ERROR_FALLBACK", "DYNAMIC_SERVER_USAGE", "BAILOUT_TO_CLIENT_SIDE_RENDERING"])(
    "recognises exact message %s",
    (message) => {
      expect(isFrameworkSignal(new Error(message))).toBe(true);
    },
  );

  it("recognises the RedirectSignal test double", () => {
    expect(isFrameworkSignal(new RedirectSignal("/x"))).toBe(true);
  });

  it.each([null, undefined, "NEXT_REDIRECT", 42, true, Symbol("s")])("returns false for non-object %s", (value) => {
    expect(isFrameworkSignal(value)).toBe(false);
  });

  it("returns false for plain errors", () => {
    expect(isFrameworkSignal(new Error("network down"))).toBe(false);
    expect(isFrameworkSignal(new TypeError("x"))).toBe(false);
  });

  it("returns false for unrelated digests", () => {
    expect(isFrameworkSignal({ digest: "SOME_OTHER" })).toBe(false);
    expect(isFrameworkSignal({ digest: 123 })).toBe(false);
  });

  it("does not match when the framework name is only a substring of the message", () => {
    expect(isFrameworkSignal(new Error("got NEXT_REDIRECT somewhere"))).toBe(false);
  });

  it("returns false for objects without digest or message", () => {
    expect(isFrameworkSignal({})).toBe(false);
  });
});

describe("runAction", () => {
  it("returns the wrapped function's result on success", async () => {
    await expect(runAction<{ error?: string; success?: boolean }>("ctx", async () => ({ success: true }))).resolves.toEqual({ success: true });
    expect(logErrorMock).not.toHaveBeenCalled();
  });

  it("passes through returned {error} results without logging", async () => {
    await expect(runAction("ctx", async () => ({ error: "Bad input" }))).resolves.toEqual({ error: "Bad input" });
    expect(logErrorMock).not.toHaveBeenCalled();
  });

  it("converts a thrown Error into the friendly message and logs it", async () => {
    const boom = new Error("db exploded");
    const result = await runAction("things.do", async () => {
      throw boom;
    });
    expect(result).toEqual({ error: "Something went wrong. Please try again." });
    expect(logErrorMock).toHaveBeenCalledWith("action:things.do", boom);
  });

  it("converts thrown non-Error values too", async () => {
    const result = await runAction("ctx", async () => {
      throw "just a string";
    });
    expect(result).toEqual({ error: "Something went wrong. Please try again." });
    expect(logErrorMock).toHaveBeenCalledWith("action:ctx", "just a string");
  });

  it("looks the message up in the common namespace", async () => {
    await runAction("ctx", async () => {
      throw new Error("x");
    });
    expect(getTranslationsMock).toHaveBeenCalledWith("common");
  });

  it("falls back to the English message when translation lookup fails", async () => {
    getTranslationsMock.mockRejectedValueOnce(new Error("no i18n"));
    const result = await runAction("ctx", async () => {
      throw new Error("x");
    });
    expect(result).toEqual({ error: "Something went wrong. Please try again." });
    expect(logErrorMock).toHaveBeenCalledTimes(1);
  });

  it("uses the translated message when the locale is not English", async () => {
    const fr = (await import("@tests/helpers/utils")).nextIntlServerMock("fr");
    getTranslationsMock.mockImplementation(fr.getTranslations);
    const result = await runAction("ctx", async () => {
      throw new Error("x");
    });
    expect(result).toEqual({ error: expect.not.stringMatching(/^Something went wrong/) });
    expect((result as { error: string }).error.length).toBeGreaterThan(0);
  });

  it("re-throws a RedirectSignal without logging", async () => {
    const signal = new RedirectSignal("/dashboard");
    await expect(
      runAction("ctx", async () => {
        throw signal;
      }),
    ).rejects.toBe(signal);
    expect(logErrorMock).not.toHaveBeenCalled();
  });

  it.each([
    "NEXT_REDIRECT;replace;/x;307;",
    "NEXT_NOT_FOUND",
    "NEXT_HTTP_ERROR_FALLBACK;404",
    "DYNAMIC_SERVER_USAGE",
    "BAILOUT_TO_CLIENT_SIDE_RENDERING",
  ])("re-throws framework digest %s", async (digest) => {
    const err = Object.assign(new Error("framework"), { digest });
    await expect(
      runAction("ctx", async () => {
        throw err;
      }),
    ).rejects.toBe(err);
    expect(logErrorMock).not.toHaveBeenCalled();
  });
});
