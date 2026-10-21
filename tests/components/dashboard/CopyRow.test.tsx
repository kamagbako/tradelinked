import { afterEach, describe, expect, it, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import { CopyRow } from "@/components/dashboard/CopyRow";
import { renderWithIntl } from "@tests/helpers/utils";

afterEach(() => {
  vi.useRealTimers();
});

describe("CopyRow", () => {
  it("shows the label and value", () => {
    renderWithIntl(<CopyRow label="BTC address" value="bc1qxyz" />);
    expect(screen.getByText("BTC address")).toBeInTheDocument();
    expect(screen.getByText("bc1qxyz")).toBeInTheDocument();
  });

  it("names the copy button after the label", () => {
    renderWithIntl(<CopyRow label="Bank name" value="First Bank" />);
    expect(screen.getByRole("button", { name: "Copy Bank name" })).toBeInTheDocument();
  });

  it("writes the value to the clipboard on click", async () => {
    const { user } = renderWithIntl(<CopyRow label="Account number" value="0123456789" />);
    await user.click(screen.getByRole("button", { name: "Copy Account number" }));
    expect(await navigator.clipboard.readText()).toBe("0123456789");
  });

  it("swaps to a check icon after copying and reverts after 1.5 seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { user, container } = renderWithIntl(<CopyRow label="X" value="y" />);
    expect(container.querySelector("svg.lucide-copy")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Copy X" }));
    expect(container.querySelector("svg.lucide-check")).toBeInTheDocument();
    expect(container.querySelector("svg.lucide-copy")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1600);
    });
    expect(container.querySelector("svg.lucide-copy")).toBeInTheDocument();
    expect(container.querySelector("svg.lucide-check")).not.toBeInTheDocument();
  });

  it("does not crash and stays in the idle state when the clipboard is unavailable", async () => {
    const { user, container } = renderWithIntl(<CopyRow label="X" value="y" />);
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    await user.click(screen.getByRole("button", { name: "Copy X" }));
    expect(container.querySelector("svg.lucide-copy")).toBeInTheDocument();
    expect(container.querySelector("svg.lucide-check")).not.toBeInTheDocument();
  });

  it("translates the button name in other locales", () => {
    renderWithIntl(<CopyRow label="Clé" value="abc" />, { locale: "fr" });
    expect(screen.getByRole("button", { name: "Copier Clé" })).toBeInTheDocument();
  });

  it("merges an extra className onto the root element without dropping the base styling", () => {
    const { container } = renderWithIntl(<CopyRow label="X" value="y" className="flex-1" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveClass("flex-1");
    expect(root).toHaveClass("rounded-xl"); // base styling still present
  });

  it("works with no className given at all", () => {
    const { container } = renderWithIntl(<CopyRow label="X" value="y" />);
    expect(container.firstElementChild).toHaveClass("rounded-xl");
  });
});
