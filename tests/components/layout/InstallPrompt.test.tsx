import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithIntl } from "@tests/helpers/utils";
import { InstallPrompt } from "@/components/layout/InstallPrompt";

const DISMISSED_KEY = "tradelinked-install-dismissed";

function makeInstallEvent(outcome: "accepted" | "dismissed" = "accepted") {
  const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
    prompt: ReturnType<typeof vi.fn>;
    userChoice: Promise<{ outcome: string }>;
  };
  event.prompt = vi.fn(async () => {});
  event.userChoice = Promise.resolve({ outcome });
  return event;
}

function fire(event: Event) {
  act(() => {
    window.dispatchEvent(event);
  });
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("InstallPrompt", () => {
  it("renders nothing until the browser offers an install prompt", () => {
    const { container } = renderWithIntl(<InstallPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it("appears when beforeinstallprompt fires", () => {
    renderWithIntl(<InstallPrompt />);
    fire(makeInstallEvent());
    const region = screen.getByRole("region", { name: "Install app" });
    expect(region).toHaveTextContent("Install TradeLinked");
    expect(region).toHaveTextContent("Add to your home screen for quick access.");
    expect(screen.getByRole("button", { name: "Install" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
  });

  it("prevents the browser's default mini-infobar", () => {
    renderWithIntl(<InstallPrompt />);
    const event = makeInstallEvent();
    fire(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("is hidden on larger screens (sm:hidden)", () => {
    renderWithIntl(<InstallPrompt />);
    fire(makeInstallEvent());
    expect(screen.getByRole("region")).toHaveClass("sm:hidden");
  });

  it("calls the deferred event's prompt() when Install is clicked", async () => {
    const { user } = renderWithIntl(<InstallPrompt />);
    const event = makeInstallEvent();
    fire(event);
    await user.click(screen.getByRole("button", { name: "Install" }));
    expect(event.prompt).toHaveBeenCalledTimes(1);
  });

  it("hides and remembers the dismissal after installing", async () => {
    const { user } = renderWithIntl(<InstallPrompt />);
    fire(makeInstallEvent());
    await user.click(screen.getByRole("button", { name: "Install" }));
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(localStorage.getItem(DISMISSED_KEY)).toBe("1");
  });

  it("hides and persists the dismissal when Dismiss is clicked, without prompting", async () => {
    const { user } = renderWithIntl(<InstallPrompt />);
    const event = makeInstallEvent();
    fire(event);
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(localStorage.getItem(DISMISSED_KEY)).toBe("1");
    expect(event.prompt).not.toHaveBeenCalled();
  });

  it("does not show the prompt when previously dismissed", () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    const { container } = renderWithIntl(<InstallPrompt />);
    const event = makeInstallEvent();
    fire(event);
    expect(container).toBeEmptyDOMElement();
    expect(event.defaultPrevented).toBe(false);
  });

  it("does not persist anything before the user acts", () => {
    renderWithIntl(<InstallPrompt />);
    fire(makeInstallEvent());
    expect(localStorage.getItem(DISMISSED_KEY)).toBeNull();
  });

  it("ignores a stored value other than '1'", () => {
    localStorage.setItem(DISMISSED_KEY, "0");
    renderWithIntl(<InstallPrompt />);
    fire(makeInstallEvent());
    expect(screen.getByRole("region")).toBeInTheDocument();
  });

  it("stays dismissed on the next mount", async () => {
    const first = renderWithIntl(<InstallPrompt />);
    fire(makeInstallEvent());
    await first.user.click(screen.getByRole("button", { name: "Dismiss" }));
    first.unmount();

    const { container } = renderWithIntl(<InstallPrompt />);
    fire(makeInstallEvent());
    expect(container).toBeEmptyDOMElement();
  });

  it("removes its window listener on unmount", () => {
    const { unmount, container } = renderWithIntl(<InstallPrompt />);
    unmount();
    const event = makeInstallEvent();
    fire(event);
    expect(event.defaultPrevented).toBe(false);
    expect(container).toBeEmptyDOMElement();
  });

  it("still shows the prompt when localStorage reads throw", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    renderWithIntl(<InstallPrompt />);
    fire(makeInstallEvent());
    expect(screen.getByRole("region")).toBeInTheDocument();
  });

  it("still hides when localStorage writes throw", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { user } = renderWithIntl(<InstallPrompt />);
    fire(makeInstallEvent());
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("uses the most recent event when the browser fires it again", async () => {
    const { user } = renderWithIntl(<InstallPrompt />);
    const first = makeInstallEvent();
    const second = makeInstallEvent();
    fire(first);
    fire(second);
    await user.click(screen.getByRole("button", { name: "Install" }));
    expect(second.prompt).toHaveBeenCalledTimes(1);
    expect(first.prompt).not.toHaveBeenCalled();
  });

  it("is translated", () => {
    renderWithIntl(<InstallPrompt />, { locale: "fr" });
    fire(makeInstallEvent());
    expect(screen.queryByRole("button", { name: "Install" })).not.toBeInTheDocument();
    expect(screen.getByRole("region")).toBeInTheDocument();
  });
});
