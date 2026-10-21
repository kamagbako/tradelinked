import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FreezeButton } from "@/components/admin/FreezeButton";
import { toggleUserFreeze } from "@/lib/actions/settings";

vi.mock("@/lib/actions/settings", () => ({ toggleUserFreeze: vi.fn() }));

const toggle = vi.mocked(toggleUserFreeze);

beforeEach(() => {
  toggle.mockResolvedValue({ success: true });
});

describe("FreezeButton", () => {
  it("offers Freeze for an active user", () => {
    render(<FreezeButton userId="u1" isFrozen={false} />);
    const button = screen.getByRole("button", { name: "Freeze" });
    expect(button).toHaveClass("text-red-400");
  });

  it("offers Unfreeze for a frozen user", () => {
    render(<FreezeButton userId="u1" isFrozen />);
    const button = screen.getByRole("button", { name: "Unfreeze" });
    expect(button).toHaveClass("bg-emerald-500");
  });

  it("freezes an active user and flips the label", async () => {
    const user = userEvent.setup();
    render(<FreezeButton userId="u1" isFrozen={false} />);
    await user.click(screen.getByRole("button", { name: "Freeze" }));

    expect(toggle).toHaveBeenCalledExactlyOnceWith("u1", true);
    expect(await screen.findByRole("button", { name: "Unfreeze" })).toBeInTheDocument();
  });

  it("unfreezes a frozen user and flips the label", async () => {
    const user = userEvent.setup();
    render(<FreezeButton userId="u2" isFrozen />);
    await user.click(screen.getByRole("button", { name: "Unfreeze" }));

    expect(toggle).toHaveBeenCalledExactlyOnceWith("u2", false);
    expect(await screen.findByRole("button", { name: "Freeze" })).toBeInTheDocument();
  });

  it("can toggle back and forth", async () => {
    const user = userEvent.setup();
    render(<FreezeButton userId="u1" isFrozen={false} />);
    await user.click(screen.getByRole("button", { name: "Freeze" }));
    await user.click(await screen.findByRole("button", { name: "Unfreeze" }));

    expect(toggle).toHaveBeenNthCalledWith(1, "u1", true);
    expect(toggle).toHaveBeenNthCalledWith(2, "u1", false);
    expect(await screen.findByRole("button", { name: "Freeze" })).toBeInTheDocument();
  });

  it("keeps the current state when the action fails", async () => {
    toggle.mockResolvedValue({ error: "Not allowed" });
    const user = userEvent.setup();
    render(<FreezeButton userId="u1" isFrozen={false} />);
    await user.click(screen.getByRole("button", { name: "Freeze" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Freeze" })).toBeEnabled());
    expect(screen.queryByRole("button", { name: "Unfreeze" })).not.toBeInTheDocument();
  });

  it("is disabled with a spinner while the action is in flight", async () => {
    let resolve!: (v: { success: boolean }) => void;
    toggle.mockReturnValue(new Promise((r) => (resolve = r)));
    const user = userEvent.setup();
    const { container } = render(<FreezeButton userId="u1" isFrozen={false} />);
    await user.click(screen.getByRole("button", { name: "Freeze" }));

    expect(screen.getByRole("button", { name: "Freeze" })).toBeDisabled();
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();

    await act(async () => resolve({ success: true }));
    expect(await screen.findByRole("button", { name: "Unfreeze" })).toBeEnabled();
    expect(container.querySelector(".animate-spin")).not.toBeInTheDocument();
  });
});
