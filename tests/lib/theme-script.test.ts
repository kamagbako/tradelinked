import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_STORAGE_KEY, themeInitScript } from "@/lib/theme-script";

function mockSystemLight(light: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) => ({ matches: light && query.includes("light"), media: query }) as MediaQueryList,
  );
}

function run() {
  new Function(themeInitScript)();
}

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe("themeInitScript", () => {
  it("uses the same storage key as the exported constant", () => {
    expect(THEME_STORAGE_KEY).toBe("tradelinked-theme");
    expect(themeInitScript).toContain(THEME_STORAGE_KEY);
  });

  it("applies a saved light theme regardless of system preference", () => {
    mockSystemLight(false);
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    run();
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("applies a saved dark theme regardless of system preference", () => {
    mockSystemLight(true);
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    run();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("uses light when nothing is saved and the system prefers light", () => {
    mockSystemLight(true);
    run();
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("uses dark when nothing is saved and the system prefers dark", () => {
    mockSystemLight(false);
    run();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("ignores an invalid saved value and falls back to system preference", () => {
    mockSystemLight(true);
    localStorage.setItem(THEME_STORAGE_KEY, "purple");
    run();
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("falls back to dark when localStorage throws", () => {
    mockSystemLight(true);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    run();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("falls back to dark when matchMedia throws", () => {
    vi.spyOn(window, "matchMedia").mockImplementation(() => {
      throw new Error("unsupported");
    });
    run();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("does not throw", () => {
    mockSystemLight(false);
    expect(run).not.toThrow();
  });
});
