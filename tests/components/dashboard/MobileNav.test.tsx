import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { MobileNav } from "@/components/dashboard/MobileNav";
import { signOut } from "@/lib/actions/auth";
import { setLocale } from "@/lib/actions/locale";
import { renderWithIntl } from "@tests/helpers/utils";

const nav = vi.hoisted(() => ({ pathname: "/dashboard", refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ refresh: nav.refresh, push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/lib/actions/auth", () => ({ signOut: vi.fn() }));
vi.mock("@/lib/actions/locale", () => ({ setLocale: vi.fn(async () => {}) }));

// jsdom cannot navigate; swallow link clicks so they do not log "not implemented" errors.
const swallowLinkNavigation = (e: MouseEvent) => {
  if ((e.target as Element).closest("a")) e.preventDefault();
};

afterEach(() => {
  document.removeEventListener("click", swallowLinkNavigation);
});

beforeEach(() => {
  document.addEventListener("click", swallowLinkNavigation);
  nav.pathname = "/dashboard";
  document.documentElement.removeAttribute("data-theme");
});

const bar = () => screen.getByRole("navigation", { name: "Main" });
// The dock's one button (react-floating-dock uses the same string for its visible label and its
// aria-label), so a name-less query is also locale-agnostic — useful for the French/Chinese tests.
const moreButton = () => screen.getByRole("button");

async function openMore(props: { isAdmin?: boolean; unreadMessages?: number } = {}, locale = "en") {
  const utils = renderWithIntl(<MobileNav {...props} />, { locale });
  await utils.user.click(moreButton());
  return { ...utils, dialog: await screen.findByRole("dialog") };
}

describe("MobileNav bar", () => {
  it("renders the four primary tabs with the right links", () => {
    renderWithIntl(<MobileNav />);
    const links = within(bar()).getAllByRole("link");
    expect(links.map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
      ["Home", "/dashboard"],
      ["Deposit", "/dashboard/deposit"],
      ["Withdraw", "/dashboard/withdraw"],
      ["History", "/dashboard/transactions"],
    ]);
  });

  it("has a More button after the tabs", () => {
    renderWithIntl(<MobileNav />);
    expect(within(bar()).getAllByRole("button")).toHaveLength(1);
    expect(moreButton()).toHaveTextContent("More");
  });

  it("does not list secondary destinations in the bar", () => {
    renderWithIntl(<MobileNav />);
    expect(within(bar()).queryByRole("link", { name: /profile/i })).not.toBeInTheDocument();
    expect(within(bar()).queryByRole("link", { name: /2FA/i })).not.toBeInTheDocument();
  });

  it.each([
    ["/dashboard", "Home"],
    ["/dashboard/deposit", "Deposit"],
    ["/dashboard/withdraw", "Withdraw"],
    ["/dashboard/transactions", "History"],
  ])("marks the %s tab as current", (pathname, label) => {
    nav.pathname = pathname;
    renderWithIntl(<MobileNav />);
    const current = within(bar()).getAllByRole("link").filter((l) => l.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent(label);
  });

  it("does not mark Home as current on nested dashboard pages", () => {
    nav.pathname = "/dashboard/deposit";
    renderWithIntl(<MobileNav />);
    expect(within(bar()).getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });

  it("keeps a primary tab current on sub-paths", () => {
    nav.pathname = "/dashboard/transactions/123";
    renderWithIntl(<MobileNav />);
    expect(within(bar()).getByRole("link", { name: "History" })).toHaveAttribute("aria-current", "page");
  });

  it("highlights More when a secondary destination is active", () => {
    nav.pathname = "/dashboard/profile";
    renderWithIntl(<MobileNav />);
    expect(moreButton().querySelector("svg")).toHaveClass("rfd-icon--active");
    expect(within(bar()).getAllByRole("link").every((l) => !l.hasAttribute("aria-current"))).toBe(true);
  });

  it("does not highlight More when a primary tab is active", () => {
    renderWithIntl(<MobileNav />);
    expect(moreButton().querySelector("svg")).not.toHaveClass("rfd-icon--active");
  });

  it("does not render the sheet until More is pressed", () => {
    renderWithIntl(<MobileNav />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("MobileNav More sheet", () => {
  it("opens a dialog titled Menu", async () => {
    const { dialog } = await openMore();
    expect(within(dialog).getByRole("heading", { name: "Menu" })).toBeInTheDocument();
  });

  it("lists the remaining destinations with their links", async () => {
    const { dialog } = await openMore();
    const links = within(dialog).getAllByRole("link");
    expect(links.map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
      ["Plans", "/dashboard/plans"],
      ["Messages", "/dashboard/messages"],
      ["2FA Setting", "/dashboard/2fa"],
      ["Profile", "/dashboard/profile"],
      ["Change Password", "/dashboard/change-password"],
    ]);
  });

  it("does not repeat the primary tabs in the sheet", async () => {
    const { dialog } = await openMore();
    expect(within(dialog).queryByRole("link", { name: "Deposit" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("link", { name: "Transactions" })).not.toBeInTheDocument();
  });

  it("hides the admin entry for regular users", async () => {
    const { dialog } = await openMore();
    expect(within(dialog).queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
  });

  it("shows the admin entry for admins", async () => {
    const { dialog } = await openMore({ isAdmin: true });
    expect(within(dialog).getByRole("link", { name: "Admin" })).toHaveAttribute("href", "/admin");
  });

  it("includes the theme toggle with its label", async () => {
    const { dialog } = await openMore();
    expect(within(dialog).getByText("Theme")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Toggle light and dark mode" })).toBeInTheDocument();
  });

  it("switches the theme from the sheet", async () => {
    const { user, dialog } = await openMore();
    await user.click(within(dialog).getByRole("button", { name: "Toggle light and dark mode" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    await user.click(within(dialog).getByRole("button", { name: "Toggle light and dark mode" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("lists every language as a pill with the current one pressed", async () => {
    const { dialog } = await openMore();
    const group = within(dialog).getByRole("group", { name: "Language" });
    const pills = within(group).getAllByRole("button");
    expect(pills.map((p) => p.textContent)).toEqual(["English", "Français", "Español", "Português", "Deutsch", "中文"]);
    expect(within(group).getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
    expect(within(group).getByRole("button", { name: "Français" })).toHaveAttribute("aria-pressed", "false");
  });

  it("changes language from a pill and refreshes the router", async () => {
    const { user, dialog } = await openMore();
    await user.click(within(dialog).getByRole("button", { name: "Español" }));
    await waitFor(() => expect(nav.refresh).toHaveBeenCalledTimes(1));
    expect(setLocale).toHaveBeenCalledWith("es");
  });

  it("does nothing when the current language pill is pressed", async () => {
    const { user, dialog } = await openMore();
    await user.click(within(dialog).getByRole("button", { name: "English" }));
    expect(setLocale).not.toHaveBeenCalled();
    expect(nav.refresh).not.toHaveBeenCalled();
  });

  it("has a log out button that submits the sign-out action", async () => {
    const { user, dialog } = await openMore();
    expect(within(dialog).getByText("Log out")).toBeInTheDocument();
    const logout = dialog.querySelector("form button[type=submit]") as HTMLButtonElement;
    await user.click(logout);
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("closes when a destination link is chosen", async () => {
    const { user, dialog } = await openMore();
    await user.click(within(dialog).getByRole("link", { name: "Profile" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("closes with the close button", async () => {
    const { user, dialog } = await openMore();
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("highlights the active secondary destination", async () => {
    nav.pathname = "/dashboard/2fa";
    const { dialog } = await openMore();
    const active = within(dialog).getByRole("link", { name: "2FA Setting" }).querySelector("span");
    const inactive = within(dialog).getByRole("link", { name: "Profile" }).querySelector("span");
    expect(active).toHaveClass("rfd-more-icon-circle--active");
    expect(inactive).not.toHaveClass("rfd-more-icon-circle--active");
  });

  describe("unread messages", () => {
    it("shows no badge on the Messages tile, and no dot on More, by default", async () => {
      const { dialog } = await openMore();
      const tile = within(dialog).getByRole("link", { name: /Messages/ });
      expect(within(tile).queryByText(/^\d+\+?$/)).not.toBeInTheDocument();
      // Scoped to the bar, not the global moreButton() helper — the sheet's own Close button is
      // also on screen by this point, so an unscoped button query would be ambiguous.
      expect(within(bar()).getByRole("button").querySelector(".rfd-badge")).toBeNull();
    });

    it("shows a dot on More when there are unread messages", () => {
      renderWithIntl(<MobileNav unreadMessages={1} />);
      expect(moreButton().querySelector(".rfd-badge--dot")).not.toBeNull();
    });

    it("shows the unread count on the Messages tile in the sheet", async () => {
      const { dialog } = await openMore({ unreadMessages: 5 });
      const tile = within(dialog).getByRole("link", { name: /Messages/ });
      expect(within(tile).getByText("5")).toBeInTheDocument();
    });

    it("caps the tile count at 9+", async () => {
      const { dialog } = await openMore({ unreadMessages: 15 });
      const tile = within(dialog).getByRole("link", { name: /Messages/ });
      expect(within(tile).getByText("9+")).toBeInTheDocument();
    });

    it("does not put a count badge on other sheet tiles", async () => {
      const { dialog } = await openMore({ unreadMessages: 5 });
      const tile = within(dialog).getByRole("link", { name: "Profile" });
      expect(within(tile).queryByText(/^\d+\+?$/)).not.toBeInTheDocument();
    });
  });
});

describe("MobileNav localisation", () => {
  it("renders French tab labels and sheet entries", async () => {
    const { dialog } = await openMore({}, "fr");
    const barLinks = within(screen.getByRole("navigation", { name: "Principal" })).getAllByRole("link");
    expect(barLinks.map((l) => l.textContent)).toEqual(["Accueil", "Dépôt", "Retrait", "Historique"]);
    expect(within(dialog).getByRole("link", { name: "Profil" })).toBeInTheDocument();
    expect(within(dialog).getByText("Langue")).toBeInTheDocument();
  });

  it("renders Chinese tab labels", () => {
    renderWithIntl(<MobileNav />, { locale: "zh" });
    const barLinks = within(screen.getByRole("navigation", { name: "主导航" })).getAllByRole("link");
    expect(barLinks.map((l) => l.textContent)).toEqual(["首页", "存款", "提款", "记录"]);
    expect(screen.getByRole("button", { name: "更多" })).toBeInTheDocument();
  });
});
