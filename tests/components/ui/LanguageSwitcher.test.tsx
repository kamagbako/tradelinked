import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { renderWithIntl } from "@tests/helpers/utils";
import { LOCALES } from "@/i18n/config";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, replace: vi.fn(), push: vi.fn() }) }));

const setLocale = vi.fn<(code: string) => Promise<void>>(async () => {});
vi.mock("@/lib/actions/locale", () => ({ setLocale: (code: string) => setLocale(code) }));

import { LanguagePills, LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    refresh.mockClear();
    setLocale.mockClear();
  });

  it("shows the current language on the trigger with listbox semantics", () => {
    renderWithIntl(<LanguageSwitcher />);
    const trigger = screen.getByRole("button", { name: "Language: English" });
    expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("reflects a non-default current locale", () => {
    renderWithIntl(<LanguageSwitcher />, { locale: "fr" });
    expect(screen.getByRole("button", { name: "Langue: Français" })).toBeInTheDocument();
  });

  it("translates its accessible label into the active language", () => {
    renderWithIntl(<LanguageSwitcher />, { locale: "zh" });
    expect(screen.getByRole("button", { name: /^语言/ })).toBeInTheDocument();
  });

  it("does not render the list until opened", () => {
    renderWithIntl(<LanguageSwitcher />);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("opens a listbox with every configured locale", async () => {
    const { user } = renderWithIntl(<LanguageSwitcher />);
    const trigger = screen.getByRole("button", { name: /Language:/ });
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options).toHaveLength(LOCALES.length);
    for (const l of LOCALES) {
      expect(within(screen.getByRole("listbox")).getByRole("button", { name: l.name })).toBeInTheDocument();
    }
  });

  it("marks only the current locale as aria-selected", async () => {
    const { user } = renderWithIntl(<LanguageSwitcher />, { locale: "es" });
    await user.click(screen.getByRole("button", { name: /Idioma:/ }));
    const options = screen.getAllByRole("option", { selected: true });
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Español");
    for (const l of LOCALES.filter((l) => l.code !== "es")) {
      expect(screen.getByRole("option", { name: l.name, selected: false })).toBeInTheDocument();
    }
  });

  it("toggles closed when the trigger is clicked again", async () => {
    const { user } = renderWithIntl(<LanguageSwitcher />);
    const trigger = screen.getByRole("button", { name: /Language:/ });
    await user.click(trigger);
    await user.click(trigger);
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("calls the setLocale action and then refreshes the router when another language is chosen", async () => {
    const { user } = renderWithIntl(<LanguageSwitcher />);
    await user.click(screen.getByRole("button", { name: /Language:/ }));
    await user.click(screen.getByRole("button", { name: "Français" }));
    expect(setLocale).toHaveBeenCalledWith("fr");
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(setLocale.mock.invocationCallOrder[0]).toBeLessThan(refresh.mock.invocationCallOrder[0]);
  });

  it("does not refresh before the setLocale action resolves", async () => {
    let resolve!: () => void;
    setLocale.mockImplementationOnce(() => new Promise<void>((r) => (resolve = r)));
    const { user } = renderWithIntl(<LanguageSwitcher />);
    await user.click(screen.getByRole("button", { name: /Language:/ }));
    await user.click(screen.getByRole("button", { name: "Deutsch" }));
    expect(setLocale).toHaveBeenCalledWith("de");
    expect(refresh).not.toHaveBeenCalled();
    resolve();
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it("closes the list after choosing", async () => {
    const { user } = renderWithIntl(<LanguageSwitcher />);
    await user.click(screen.getByRole("button", { name: /Language:/ }));
    await user.click(screen.getByRole("button", { name: "Deutsch" }));
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
  });

  it("does nothing (no action, no refresh) when the current language is chosen, but closes", async () => {
    const { user } = renderWithIntl(<LanguageSwitcher />);
    await user.click(screen.getByRole("button", { name: /Language:/ }));
    await user.click(within(screen.getByRole("listbox")).getByRole("button", { name: "English" }));
    expect(setLocale).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
  });

  it("closes on Escape", async () => {
    const { user } = renderWithIntl(<LanguageSwitcher />);
    await user.click(screen.getByRole("button", { name: /Language:/ }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    expect(setLocale).not.toHaveBeenCalled();
  });

  it("closes on an outside mouse press", async () => {
    const { user } = renderWithIntl(
      <div>
        <button type="button">outside</button>
        <LanguageSwitcher />
      </div>,
    );
    await user.click(screen.getByRole("button", { name: /Language:/ }));
    await user.click(screen.getByRole("button", { name: "outside" }));
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
  });

  it("stays open when pressing inside the list container", async () => {
    const { user } = renderWithIntl(<LanguageSwitcher />);
    await user.click(screen.getByRole("button", { name: /Language:/ }));
    await user.pointer({ keys: "[MouseLeft>]", target: screen.getByRole("listbox") });
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("ignores other keys while open", async () => {
    const { user } = renderWithIntl(<LanguageSwitcher />);
    await user.click(screen.getByRole("button", { name: /Language:/ }));
    await user.keyboard("a");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("removes its document listeners after closing", async () => {
    const remove = vi.spyOn(document, "removeEventListener");
    const { user } = renderWithIntl(<LanguageSwitcher />);
    await user.click(screen.getByRole("button", { name: /Language:/ }));
    await user.keyboard("{Escape}");
    const removed = remove.mock.calls.map((c) => c[0]);
    expect(removed).toContain("keydown");
    expect(removed).toContain("mousedown");
  });

  it("aligns the list to the right by default and to the left when asked", async () => {
    const { user, unmount } = renderWithIntl(<LanguageSwitcher />);
    await user.click(screen.getByRole("button", { name: /Language:/ }));
    expect(screen.getByRole("listbox")).toHaveClass("right-0");
    unmount();

    const second = renderWithIntl(<LanguageSwitcher align="left" />);
    await second.user.click(screen.getByRole("button", { name: /Language:/ }));
    expect(screen.getByRole("listbox")).toHaveClass("left-0");
  });

  it("applies a custom className to the wrapper", () => {
    const { container } = renderWithIntl(<LanguageSwitcher className="ml-auto" />);
    expect(container.firstChild).toHaveClass("relative", "ml-auto");
  });
});

describe("LanguagePills", () => {
  beforeEach(() => {
    refresh.mockClear();
    setLocale.mockClear();
  });

  it("renders a labelled group with one button per locale", () => {
    renderWithIntl(<LanguagePills />);
    const group = screen.getByRole("group", { name: "Language" });
    expect(within(group).getAllByRole("button")).toHaveLength(LOCALES.length);
  });

  it("translates the pills group label", () => {
    renderWithIntl(<LanguagePills />, { locale: "de" });
    expect(screen.getByRole("group", { name: "Sprache" })).toBeInTheDocument();
  });

  it("marks only the current locale as pressed", () => {
    renderWithIntl(<LanguagePills />, { locale: "pt" });
    const pressed = screen.getAllByRole("button", { pressed: true });
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toHaveTextContent("Português");
    expect(screen.getAllByRole("button", { pressed: false })).toHaveLength(LOCALES.length - 1);
  });

  it("calls setLocale and refreshes when another pill is chosen", async () => {
    const { user } = renderWithIntl(<LanguagePills />);
    await user.click(screen.getByRole("button", { name: "中文" }));
    expect(setLocale).toHaveBeenCalledWith("zh");
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it("does nothing when the current pill is chosen", async () => {
    const { user } = renderWithIntl(<LanguagePills />);
    await user.click(screen.getByRole("button", { name: "English" }));
    expect(setLocale).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("merges a custom className", () => {
    renderWithIntl(<LanguagePills className="mt-4" />);
    expect(screen.getByRole("group")).toHaveClass("mt-4", "flex-wrap");
  });
});
