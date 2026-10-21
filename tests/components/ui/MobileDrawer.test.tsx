import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@tests/helpers/utils";
import { MobileDrawer } from "@/components/ui/MobileDrawer";

afterEach(() => {
  document.body.style.overflow = "";
});

function drawer(open: boolean, onClose = vi.fn(), children: React.ReactNode = <p>Drawer body</p>) {
  return (
    <MobileDrawer open={open} onClose={onClose} title="Filters">
      {children}
    </MobileDrawer>
  );
}

describe("MobileDrawer", () => {
  it("renders nothing while closed", () => {
    renderWithIntl(drawer(false));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Drawer body")).not.toBeInTheDocument();
  });

  it("renders a modal dialog with title and children when open", async () => {
    renderWithIntl(drawer(true));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("heading", { name: "Filters" })).toBeInTheDocument();
    expect(screen.getByText("Drawer body")).toBeInTheDocument();
  });

  it("portals the dialog into document.body, outside the render container", async () => {
    const { container } = renderWithIntl(drawer(true));
    const dialog = await screen.findByRole("dialog");
    expect(container).not.toContainElement(dialog);
    expect(document.body).toContainElement(dialog);
  });

  it("has a translated close button that calls onClose", async () => {
    const onClose = vi.fn();
    const { user } = renderWithIntl(drawer(true, onClose));
    await user.click(await screen.findByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("translates the close button label", async () => {
    renderWithIntl(drawer(true), { locale: "fr" });
    expect(await screen.findByRole("button", { name: "Fermer" })).toBeInTheDocument();
  });

  it("calls onClose when the backdrop is clicked", async () => {
    const onClose = vi.fn();
    const { user } = renderWithIntl(drawer(true, onClose));
    const dialog = await screen.findByRole("dialog");
    const backdrop = dialog.parentElement!.querySelector<HTMLElement>(".bg-black\\/60")!;
    expect(backdrop).toBeInTheDocument();
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when clicking inside the dialog", async () => {
    const onClose = vi.fn();
    const { user } = renderWithIntl(drawer(true, onClose));
    await user.click(await screen.findByText("Drawer body"));
    await user.click(screen.getByRole("heading", { name: "Filters" }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not call onClose on its own", async () => {
    const onClose = vi.fn();
    renderWithIntl(drawer(true, onClose));
    await screen.findByRole("dialog");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("locks body scroll while open", async () => {
    renderWithIntl(drawer(true));
    await screen.findByRole("dialog");
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("does not lock body scroll while closed", () => {
    renderWithIntl(drawer(false));
    expect(document.body.style.overflow).toBe("");
  });

  it("restores the previous body overflow when closed", async () => {
    document.body.style.overflow = "scroll";
    const { rerender } = renderWithIntl(drawer(true));
    await screen.findByRole("dialog");
    expect(document.body.style.overflow).toBe("hidden");
    rerender(drawer(false));
    expect(document.body.style.overflow).toBe("scroll");
  });

  it("restores body overflow when unmounted while open", async () => {
    const { unmount } = renderWithIntl(drawer(true));
    await screen.findByRole("dialog");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("removes the dialog after closing (exit animation completes)", async () => {
    const { rerender } = renderWithIntl(drawer(true));
    await screen.findByRole("dialog");
    rerender(drawer(false));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("can be re-opened after being closed", async () => {
    const { rerender } = renderWithIntl(drawer(true));
    await screen.findByRole("dialog");
    rerender(drawer(false));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    rerender(drawer(true));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("renders interactive children that keep working", async () => {
    const onPick = vi.fn();
    const { user } = renderWithIntl(
      drawer(true, vi.fn(), (
        <button type="button" onClick={onPick}>
          Pick
        </button>
      )),
    );
    await user.click(await screen.findByRole("button", { name: "Pick" }));
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    const { user } = renderWithIntl(drawer(true, onClose));
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ignores Escape while closed", async () => {
    const onClose = vi.fn();
    const { user } = renderWithIntl(drawer(false, onClose));
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });
});
