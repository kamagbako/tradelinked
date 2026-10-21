import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { Navbar } from "@/components/layout/Navbar";
import { renderWithIntl } from "@tests/helpers/utils";
import { flatten, loadMessages } from "@tests/helpers/messages";

vi.mock("@/components/ui/LanguageSwitcher", () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />,
}));
vi.mock("@/components/ui/ThemeToggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

const NAV = [
  ["About", "/#about"],
  ["How it works", "/#how-it-works"],
  ["Plans", "/#plans"],
  ["Payments", "/#payments"],
  ["Security", "/#security"],
] as const;

const menuButton = () => screen.getByRole("button", { name: "Toggle menu" });

// jsdom cannot navigate; swallow the default action of link clicks (React onClick handlers still run).
const blockNavigation = (e: MouseEvent) => e.preventDefault();

describe("Navbar", () => {
  beforeEach(() => document.addEventListener("click", blockNavigation));
  afterEach(() => document.removeEventListener("click", blockNavigation));

  it("renders the brand linking home", () => {
    renderWithIntl(<Navbar />);
    expect(screen.getByRole("link", { name: "TradeLinked" })).toHaveAttribute("href", "/");
  });

  it("is rendered as a sticky banner landmark with a nav", () => {
    renderWithIntl(<Navbar />);
    expect(screen.getByRole("banner")).toHaveClass("sticky");
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  it.each(NAV)("links %s to %s", (label, href) => {
    renderWithIntl(<Navbar />);
    expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", href);
  });

  it("lists the five section links in order", () => {
    renderWithIntl(<Navbar />);
    const hrefs = screen
      .getAllByRole("link")
      .map((l) => l.getAttribute("href"))
      .filter((h) => h?.startsWith("/#"));
    expect(hrefs).toEqual(NAV.map(([, href]) => href));
  });

  it("links Log in to /login and Get Started to /register", () => {
    renderWithIntl(<Navbar />);
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Get Started" })).toHaveAttribute("href", "/register");
  });

  it("renders the language switcher and theme toggle for both breakpoints", () => {
    renderWithIntl(<Navbar />);
    expect(screen.getAllByTestId("language-switcher")).toHaveLength(2);
    expect(screen.getAllByTestId("theme-toggle")).toHaveLength(2);
  });

  it("keeps the mobile menu closed initially", () => {
    renderWithIntl(<Navbar />);
    expect(screen.getAllByRole("link", { name: "About" })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "Log in" })).toHaveLength(1);
  });

  it("opens the mobile menu when the toggle is clicked", async () => {
    const { user } = renderWithIntl(<Navbar />);
    await user.click(menuButton());

    for (const [label] of NAV) {
      expect(screen.getAllByRole("link", { name: label })).toHaveLength(2);
    }
    expect(screen.getAllByRole("link", { name: "Log in" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Get Started" })).toHaveLength(2);
  });

  it("gives mobile menu links the same hrefs as the desktop ones", async () => {
    const { user } = renderWithIntl(<Navbar />);
    await user.click(menuButton());
    const mobileMenu = screen.getAllByRole("link", { name: "About" })[1].parentElement!;
    const hrefs = within(mobileMenu).getAllByRole("link").map((l) => l.getAttribute("href"));
    expect(hrefs).toEqual([...NAV.map(([, href]) => href), "/login", "/register"]);
  });

  it("closes the mobile menu when the toggle is clicked again", async () => {
    const { user } = renderWithIntl(<Navbar />);
    await user.click(menuButton());
    expect(screen.getAllByRole("link", { name: "Plans" })).toHaveLength(2);

    await user.click(menuButton());
    await waitFor(() => expect(screen.getAllByRole("link", { name: "Plans" })).toHaveLength(1));
  });

  it("closes the mobile menu after choosing a section link", async () => {
    const { user } = renderWithIntl(<Navbar />);
    await user.click(menuButton());
    await user.click(screen.getAllByRole("link", { name: "Security" })[1]);
    await waitFor(() => expect(screen.getAllByRole("link", { name: "Security" })).toHaveLength(1));
  });

  it("closes the mobile menu after choosing Log in", async () => {
    const { user } = renderWithIntl(<Navbar />);
    await user.click(menuButton());
    await user.click(screen.getAllByRole("link", { name: "Log in" })[1]);
    await waitFor(() => expect(screen.getAllByRole("link", { name: "Log in" })).toHaveLength(1));
  });

  it("can be reopened after being closed", async () => {
    const { user } = renderWithIntl(<Navbar />);
    await user.click(menuButton());
    await user.click(menuButton());
    await waitFor(() => expect(screen.getAllByRole("link", { name: "About" })).toHaveLength(1));
    await user.click(menuButton());
    expect(screen.getAllByRole("link", { name: "About" })).toHaveLength(2);
  });

  it("renders French labels", () => {
    const fr = flatten(loadMessages("fr"));
    renderWithIntl(<Navbar />, { locale: "fr" });
    expect(screen.getByRole("link", { name: fr["landing.nav.plans"] })).toHaveAttribute("href", "/#plans");
    expect(screen.getByRole("link", { name: fr["landing.nav.logIn"] })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("button", { name: fr["landing.nav.toggleMenu"] })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "About" })).not.toBeInTheDocument();
  });

  it("renders Chinese labels", () => {
    const zh = flatten(loadMessages("zh"));
    renderWithIntl(<Navbar />, { locale: "zh" });
    expect(screen.getByRole("link", { name: zh["landing.nav.about"] })).toHaveAttribute("href", "/#about");
    expect(screen.getByRole("link", { name: zh["landing.nav.getStarted"] })).toHaveAttribute("href", "/register");
  });
});
