import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithIntl } from "@tests/helpers/utils";
import { THEME_STORAGE_KEY } from "@/lib/theme-script";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

function setup(theme?: "light" | "dark") {
  if (theme) document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    setup("dark");
  });

  afterEach(() => {
    setup();
    document.head.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  });

  it("renders an accessible, translated button", () => {
    renderWithIntl(<ThemeToggle />);
    const button = screen.getByRole("button", { name: "Toggle light and dark mode" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("title");
  });

  it("switches dark -> light on click", async () => {
    const { user } = renderWithIntl(<ThemeToggle />);
    await user.click(screen.getByRole("button"));
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("switches light -> dark on click", async () => {
    setup("light");
    const { user } = renderWithIntl(<ThemeToggle />);
    await user.click(screen.getByRole("button"));
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("toggles back and forth across several clicks", async () => {
    const { user } = renderWithIntl(<ThemeToggle />);
    const button = screen.getByRole("button");
    await user.click(button);
    expect(document.documentElement.dataset.theme).toBe("light");
    await user.click(button);
    expect(document.documentElement.dataset.theme).toBe("dark");
    await user.click(button);
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("treats a missing data-theme as dark and switches to light", async () => {
    setup();
    const { user } = renderWithIntl(<ThemeToggle />);
    await user.click(screen.getByRole("button"));
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("persists the choice to localStorage", async () => {
    const { user } = renderWithIntl(<ThemeToggle />);
    await user.click(screen.getByRole("button"));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    await user.click(screen.getByRole("button"));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("still switches the theme when localStorage throws", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const { user } = renderWithIntl(<ThemeToggle />);
    await user.click(screen.getByRole("button"));
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("keeps the browser theme-color meta in sync", async () => {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = "#000000";
    document.head.appendChild(meta);

    const { user } = renderWithIntl(<ThemeToggle />);
    expect(meta.content).toBe("#080c14");
    await user.click(screen.getByRole("button"));
    expect(meta.content).toBe("#f8fafc");
    await user.click(screen.getByRole("button"));
    expect(meta.content).toBe("#080c14");
  });

  it("merges a custom className", () => {
    renderWithIntl(<ThemeToggle className="ml-2" />);
    expect(screen.getByRole("button")).toHaveClass("ml-2", "h-11", "w-11");
  });

  it("includes both sun and moon icons in the DOM (no hydration flicker)", () => {
    renderWithIntl(<ThemeToggle />);
    expect(screen.getByRole("button").querySelectorAll("svg")).toHaveLength(2);
  });
});
