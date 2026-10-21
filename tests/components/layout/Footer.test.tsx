import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { Footer } from "@/components/layout/Footer";
import { renderWithIntl } from "@tests/helpers/utils";
import { flatten, loadMessages } from "@tests/helpers/messages";

afterEach(() => {
  vi.useRealTimers();
});

describe("Footer", () => {
  it("is the #contact landmark", () => {
    renderWithIntl(<Footer />);
    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveAttribute("id", "contact");
  });

  it("renders the brand and tagline", () => {
    renderWithIntl(<Footer />);
    expect(screen.getByText("TradeLinked")).toBeInTheDocument();
    expect(screen.getByText(/secure trading and investment portal/)).toBeInTheDocument();
  });

  it.each([
    ["Terms of Service", "/terms"],
    ["Privacy Policy", "/privacy"],
    ["Forex Risk Disclosure", "/risk-disclosure"],
  ])("links %s to %s", (label, href) => {
    renderWithIntl(<Footer />);
    expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", href);
  });

  it.each([
    ["About", "/#about"],
    ["Investment Plans", "/#plans"],
    ["Security", "/#security"],
    ["Log in", "/login"],
    ["Register", "/register"],
  ])("links %s to %s", (label, href) => {
    renderWithIntl(<Footer />);
    expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", href);
  });

  it("groups links under Company, Legal and Account headings", () => {
    renderWithIntl(<Footer />);
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Company",
      "Legal",
      "Account",
    ]);
  });

  it("shows the current year in the copyright line", () => {
    renderWithIntl(<Footer />);
    const year = new Date().getFullYear();
    expect(screen.getByText(new RegExp(`© ${year} TradeLinked\\. All rights reserved`))).toBeInTheDocument();
  });

  it("uses whatever year it currently is", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2031-06-15T12:00:00Z"));
    renderWithIntl(<Footer />);
    expect(screen.getByText(/© 2031 TradeLinked/)).toBeInTheDocument();
  });

  it("includes the risk warning in the copyright line", () => {
    renderWithIntl(<Footer />);
    expect(screen.getByText(/Trading involves risk; past performance does not guarantee future results\./)).toBeInTheDocument();
  });

  it("renders French copy with the year interpolated", () => {
    const fr = flatten(loadMessages("fr"));
    renderWithIntl(<Footer />, { locale: "fr" });
    expect(screen.getByRole("link", { name: fr["landing.footer.terms"] })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: fr["landing.footer.riskDisclosure"] })).toHaveAttribute(
      "href",
      "/risk-disclosure",
    );
    expect(screen.getByText(fr["landing.footer.copyright"].replace("{year}", String(new Date().getFullYear())))).toBeInTheDocument();
  });

  it("renders Chinese copy", () => {
    const zh = flatten(loadMessages("zh"));
    renderWithIntl(<Footer />, { locale: "zh" });
    expect(screen.getByText(zh["landing.footer.tagline"])).toBeInTheDocument();
    expect(screen.getByRole("link", { name: zh["landing.footer.privacy"] })).toHaveAttribute("href", "/privacy");
  });
});
