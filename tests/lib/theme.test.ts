import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTheme, syncThemeColor, useTheme } from "@/lib/theme";
import { THEME_STORAGE_KEY } from "@/lib/theme-script";

function addMeta() {
  const meta = document.createElement("meta");
  meta.setAttribute("name", "theme-color");
  meta.setAttribute("content", "#000000");
  document.head.appendChild(meta);
  return meta;
}

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

afterEach(() => {
  document.head.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  delete document.documentElement.dataset.theme;
  localStorage.clear();
});

describe("setTheme", () => {
  it("writes data-theme on the root element", () => {
    setTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    setTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("persists the choice to localStorage", () => {
    setTheme("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("still applies the theme when localStorage throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => setTheme("light")).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("updates the theme-color meta tag", () => {
    const meta = addMeta();
    setTheme("light");
    expect(meta.getAttribute("content")).toBe("#f8fafc");
    setTheme("dark");
    expect(meta.getAttribute("content")).toBe("#080c14");
  });

  it("updates the meta tag even when localStorage throws", () => {
    const meta = addMeta();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    setTheme("light");
    expect(meta.getAttribute("content")).toBe("#f8fafc");
  });
});

describe("syncThemeColor", () => {
  it("uses the dark colour when no theme attribute is set", () => {
    const meta = addMeta();
    syncThemeColor();
    expect(meta.getAttribute("content")).toBe("#080c14");
  });

  it("uses the light colour when data-theme is light", () => {
    const meta = addMeta();
    document.documentElement.dataset.theme = "light";
    syncThemeColor();
    expect(meta.getAttribute("content")).toBe("#f8fafc");
  });

  it("treats unknown theme values as dark", () => {
    const meta = addMeta();
    document.documentElement.dataset.theme = "sepia";
    syncThemeColor();
    expect(meta.getAttribute("content")).toBe("#080c14");
  });

  it("does nothing (and does not throw) without a meta tag", () => {
    expect(() => syncThemeColor()).not.toThrow();
  });
});

describe("useTheme", () => {
  it("defaults to dark", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current).toBe("dark");
  });

  it("reads the current attribute on mount", () => {
    document.documentElement.dataset.theme = "light";
    const { result } = renderHook(() => useTheme());
    expect(result.current).toBe("light");
  });

  it("reacts to attribute changes made elsewhere", async () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current).toBe("dark");
    await act(async () => {
      document.documentElement.dataset.theme = "light";
      await Promise.resolve();
    });
    expect(result.current).toBe("light");
    await act(async () => {
      document.documentElement.dataset.theme = "dark";
      await Promise.resolve();
    });
    expect(result.current).toBe("dark");
  });

  it("reacts to setTheme", async () => {
    const { result } = renderHook(() => useTheme());
    await act(async () => {
      setTheme("light");
      await Promise.resolve();
    });
    expect(result.current).toBe("light");
  });

  it("stops observing after unmount", async () => {
    const disconnect = vi.spyOn(MutationObserver.prototype, "disconnect");
    const { unmount } = renderHook(() => useTheme());
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});
