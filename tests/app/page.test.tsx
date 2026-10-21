import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import HomePage from "@/app/page";
import { renderWithIntl } from "@tests/helpers/utils";
import { flatten, loadMessages } from "@tests/helpers/messages";

const chat = vi.hoisted(() => ({ throws: false }));

vi.mock("@/components/layout/Navbar", () => ({ Navbar: () => <header data-testid="navbar" /> }));
vi.mock("@/components/marketing/ChatWidget", () => ({
  ChatWidget: () => {
    if (chat.throws) throw new Error("chat exploded");
    return <div data-testid="chat-widget" />;
  },
}));

beforeEach(() => {
  chat.throws = false;
});

describe("HomePage", () => {
  it("renders the navbar, main content, footer and chat widget", () => {
    renderWithIntl(<HomePage />);
    expect(screen.getByTestId("navbar")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByTestId("chat-widget")).toBeInTheDocument();
  });

  it("composes all sections inside main in the expected order", () => {
    renderWithIntl(<HomePage />);
    const main = screen.getByRole("main");
    const sections = Array.from(main.querySelectorAll("section")).map((s) => s.id);
    // Hero and CtaBanner have no anchor id
    expect(sections).toEqual(["", "about", "how-it-works", "plans", "payments", "security", "partners", ""]);
  });

  it("has exactly one h1 (the hero headline)", () => {
    renderWithIntl(<HomePage />);
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent("Trade smarter. Grow your portfolio with confidence.");
  });

  it.each([
    ["Investment Plans"],
    ["Accepted payment methods"],
    ["Built on Security"],
    ["Our strategic partners"],
    ["How TradeLinked works"],
    ["Ready to start?"],
  ])("renders the %s section heading", (heading) => {
    renderWithIntl(<HomePage />);
    expect(screen.getByRole("heading", { level: 2, name: heading })).toBeInTheDocument();
  });

  it("renders the three investment plans within #plans", () => {
    const { container } = renderWithIntl(<HomePage />);
    const plans = container.querySelector("#plans") as HTMLElement;
    expect(within(plans).getAllByRole("heading", { level: 3 })).toHaveLength(3);
  });

  it("registers CTAs in hero, about and banner", () => {
    renderWithIntl(<HomePage />);
    const registerLinks = screen.getAllByRole("link").filter((l) => l.getAttribute("href") === "/register");
    // hero + about "get started" + cta banner + footer "register"
    expect(registerLinks.length).toBeGreaterThanOrEqual(4);
  });

  it("includes the footer legal links", () => {
    renderWithIntl(<HomePage />);
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/terms");
  });

  it("every in-page nav target has a matching section id", () => {
    const { container } = renderWithIntl(<HomePage />);
    for (const id of ["about", "how-it-works", "plans", "payments", "security"]) {
      expect(container.querySelector(`#${id}`), id).toBeInTheDocument();
    }
  });

  describe("chat widget isolation", () => {
    it("a throwing ChatWidget does not break the rest of the page", () => {
      chat.throws = true;
      vi.spyOn(console, "error").mockImplementation(() => {});
      renderWithIntl(<HomePage />);

      expect(screen.queryByTestId("chat-widget")).not.toBeInTheDocument();
      expect(screen.getByRole("main")).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
      expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    });

    it("fails silently: no retry card or alert is shown", () => {
      chat.throws = true;
      vi.spyOn(console, "error").mockImplementation(() => {});
      renderWithIntl(<HomePage />);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
    });

    it("logs the failure under the chat boundary name", () => {
      chat.throws = true;
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      renderWithIntl(<HomePage />);
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining("[tradelinked] boundary:chat: chat exploded"),
        expect.anything(),
      );
    });
  });

  it("renders localised sections in French", () => {
    const fr = flatten(loadMessages("fr"));
    renderWithIntl(<HomePage />, { locale: "fr" });
    expect(screen.getByRole("heading", { level: 2, name: fr["landing.plans.heading"] })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: fr["landing.security.heading"] })).toBeInTheDocument();
  });

  it("renders localised sections in Chinese", () => {
    const zh = flatten(loadMessages("zh"));
    renderWithIntl(<HomePage />, { locale: "zh" });
    expect(screen.getByRole("heading", { level: 2, name: zh["landing.cta.heading"] })).toBeInTheDocument();
    expect(screen.getByText(zh["landing.hero.subtitle"])).toBeInTheDocument();
  });
});
