import { describe, expect, it, vi } from "vitest";

const { cookiesMock, setMock } = vi.hoisted(() => ({ cookiesMock: vi.fn(), setMock: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));

import { setLocale } from "@/lib/actions/locale";

describe("setLocale", () => {
  it.each(["en", "fr", "es", "pt", "de", "zh"])("stores the %s locale in the NEXT_LOCALE cookie", async (locale) => {
    cookiesMock.mockResolvedValue({ set: setMock });
    await setLocale(locale);
    expect(setMock).toHaveBeenCalledWith("NEXT_LOCALE", locale, {
      path: "/",
      maxAge: 31_536_000,
      sameSite: "lax",
    });
  });

  it.each(["", "xx", "EN", "en-US", "../etc"])("ignores unsupported locale %j", async (locale) => {
    cookiesMock.mockResolvedValue({ set: setMock });
    await setLocale(locale);
    expect(setMock).not.toHaveBeenCalled();
    expect(cookiesMock).not.toHaveBeenCalled();
  });
});
