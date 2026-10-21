import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { AdminNav } from "@/components/admin/AdminNav";
import { renderWithIntl } from "@tests/helpers/utils";

const nav = vi.hoisted(() => ({ pathname: "/admin" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

// jsdom cannot navigate; swallow link clicks so they do not log "not implemented" errors.
const swallowLinkNavigation = (e: MouseEvent) => {
  if ((e.target as Element).closest("a")) e.preventDefault();
};

afterEach(() => {
  document.removeEventListener("click", swallowLinkNavigation);
});

beforeEach(() => {
  document.addEventListener("click", swallowLinkNavigation);
  nav.pathname = "/admin";
});

const ACTIVE_DESKTOP = "text-blue-400";
const ALL_ITEMS = [
  ["Overview", "/admin"],
  ["Users", "/admin/users"],
  ["Ledger", "/admin/ledger"],
  ["Deposits", "/admin/deposits"],
  ["Withdrawals", "/admin/withdrawals"],
  ["Settings", "/admin/settings"],
] as const;
const PRIMARY_ITEMS = [
  ["Overview", "/admin"],
  ["Users", "/admin/users"],
  ["Deposits", "/admin/deposits"],
  ["Withdrawals", "/admin/withdrawals"],
] as const;

const desktop = () => screen.getByRole("complementary");
const bar = () => screen.getByRole("navigation", { name: "Admin sections" });
const moreButton = () => screen.getByRole("button", { name: "More" });

async function openMore() {
  const utils = renderWithIntl(<AdminNav />);
  await utils.user.click(moreButton());
  return { ...utils, dialog: await screen.findByRole("dialog") };
}

describe("AdminNav desktop sidebar", () => {
  it("renders a sidebar with all six sections, in order", () => {
    renderWithIntl(<AdminNav />);
    const labels = within(desktop()).getAllByRole("link").map((l) => l.textContent);
    expect(labels).toEqual(ALL_ITEMS.map(([label]) => label));
    expect(labels.indexOf("Deposits")).toBe(labels.indexOf("Ledger") + 1);
  });

  it.each(ALL_ITEMS)("links %s to %s", (label, href) => {
    renderWithIntl(<AdminNav />);
    expect(within(desktop()).getByRole("link", { name: label })).toHaveAttribute("href", href);
  });

  it.each(ALL_ITEMS)("highlights only %s when the path is %s", (label, href) => {
    nav.pathname = href;
    renderWithIntl(<AdminNav />);
    for (const link of within(desktop()).getAllByRole("link")) {
      if (link.textContent === label) expect(link).toHaveClass(ACTIVE_DESKTOP);
      else expect(link).not.toHaveClass(ACTIVE_DESKTOP);
    }
  });

  it("does not highlight Overview on nested admin pages", () => {
    nav.pathname = "/admin/users";
    renderWithIntl(<AdminNav />);
    expect(within(desktop()).getByRole("link", { name: "Overview" })).not.toHaveClass(ACTIVE_DESKTOP);
  });

  it.each([
    ["/admin/users/123", "Users"],
    ["/admin/withdrawals/abc/details", "Withdrawals"],
  ])("keeps the parent section highlighted on nested route %s", (path, label) => {
    nav.pathname = path;
    renderWithIntl(<AdminNav />);
    expect(within(desktop()).getByRole("link", { name: label })).toHaveClass(ACTIVE_DESKTOP);
  });

  it("does not treat a look-alike prefix as a nested route", () => {
    nav.pathname = "/admin/users-archive";
    renderWithIntl(<AdminNav />);
    expect(within(desktop()).getByRole("link", { name: "Users" })).not.toHaveClass(ACTIVE_DESKTOP);
  });

  it("styles inactive links as muted", () => {
    renderWithIntl(<AdminNav />);
    expect(within(desktop()).getByRole("link", { name: "Users" })).toHaveClass("text-text-muted");
  });
});

describe("AdminNav mobile bar", () => {
  it("renders the four primary sections with the right links", () => {
    renderWithIntl(<AdminNav />);
    const links = within(bar()).getAllByRole("link");
    expect(links.map((l) => [l.textContent, l.getAttribute("href")])).toEqual(
      PRIMARY_ITEMS.map(([label, href]) => [label, href]),
    );
  });

  it("has a More button after the tabs, and nothing else", () => {
    renderWithIntl(<AdminNav />);
    expect(within(bar()).getAllByRole("button")).toHaveLength(1);
    expect(moreButton()).toHaveTextContent("More");
  });

  it("does not list secondary sections in the bar", () => {
    renderWithIntl(<AdminNav />);
    expect(within(bar()).queryByRole("link", { name: "Ledger" })).not.toBeInTheDocument();
    expect(within(bar()).queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
  });

  it.each(PRIMARY_ITEMS)("marks the %s tab as current", (label, href) => {
    nav.pathname = href;
    renderWithIntl(<AdminNav />);
    const current = within(bar())
      .getAllByRole("link")
      .filter((l) => l.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent(label);
  });

  it("keeps a primary tab current on sub-paths", () => {
    nav.pathname = "/admin/deposits/123";
    renderWithIntl(<AdminNav />);
    expect(within(bar()).getByRole("link", { name: "Deposits" })).toHaveAttribute("aria-current", "page");
  });

  it("highlights More when a secondary section is active, and no primary tab is current", () => {
    nav.pathname = "/admin/settings";
    renderWithIntl(<AdminNav />);
    expect(moreButton().querySelector("svg")).toHaveClass("rfd-icon--active");
    expect(within(bar()).getAllByRole("link").every((l) => !l.hasAttribute("aria-current"))).toBe(true);
  });

  it("does not highlight More when a primary tab is active", () => {
    renderWithIntl(<AdminNav />);
    expect(moreButton().querySelector("svg")).not.toHaveClass("rfd-icon--active");
  });

  it("opens a sheet with the remaining sections when More is clicked", async () => {
    const { dialog } = await openMore();
    const links = within(dialog).getAllByRole("link");
    expect(links.map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
      ["Ledger", "/admin/ledger"],
      ["Settings", "/admin/settings"],
    ]);
  });

  it("closes the sheet after following a link from it", async () => {
    const { user, dialog } = await openMore();
    await user.click(within(dialog).getByRole("link", { name: "Ledger" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
