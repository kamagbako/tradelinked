import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { LegalPage } from "@/components/layout/LegalPage";
import { renderWithIntl } from "@tests/helpers/utils";
import { flatten, loadMessages } from "@tests/helpers/messages";

vi.mock("@/components/layout/Navbar", () => ({ Navbar: () => <nav data-testid="navbar" /> }));
vi.mock("@/components/layout/Footer", () => ({ Footer: () => <footer data-testid="footer" /> }));

describe("LegalPage", () => {
  it("renders the title as the page's h1", () => {
    renderWithIntl(<LegalPage title="Terms of Service" updated="May 2026">body</LegalPage>);
    expect(screen.getByRole("heading", { level: 1, name: "Terms of Service" })).toBeInTheDocument();
  });

  it("shows the last-updated line", () => {
    renderWithIntl(<LegalPage title="T" updated="May 2026">body</LegalPage>);
    expect(screen.getByText("Last updated May 2026")).toBeInTheDocument();
  });

  it("links back to registration", () => {
    renderWithIntl(<LegalPage title="T" updated="U">body</LegalPage>);
    expect(screen.getByRole("link", { name: "Back to registration" })).toHaveAttribute("href", "/register");
  });

  it("renders children inside main", () => {
    renderWithIntl(
      <LegalPage title="T" updated="U">
        <section>
          <h2>Section heading</h2>
          <p>Section body</p>
        </section>
      </LegalPage>,
    );
    const main = screen.getByRole("main");
    expect(main).toContainElement(screen.getByRole("heading", { level: 2, name: "Section heading" }));
    expect(main).toContainElement(screen.getByText("Section body"));
  });

  it("wraps content with the navbar and footer", () => {
    renderWithIntl(<LegalPage title="T" updated="U">body</LegalPage>);
    expect(screen.getByTestId("navbar")).toBeInTheDocument();
    expect(screen.getByTestId("footer")).toBeInTheDocument();
  });

  it("places the navbar before and the footer after main", () => {
    renderWithIntl(<LegalPage title="T" updated="U">body</LegalPage>);
    const navbar = screen.getByTestId("navbar");
    const main = screen.getByRole("main");
    const footer = screen.getByTestId("footer");
    expect(navbar.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(main.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders localised chrome in French", () => {
    const fr = flatten(loadMessages("fr"));
    renderWithIntl(<LegalPage title="Conditions" updated="mai 2026">x</LegalPage>, { locale: "fr" });
    expect(screen.getByText(fr["landing.legal.lastUpdated"].replace("{updated}", "mai 2026"))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: fr["landing.legal.backToRegistration"] })).toBeInTheDocument();
  });

  it("renders localised chrome in Chinese", () => {
    const zh = flatten(loadMessages("zh"));
    renderWithIntl(<LegalPage title="条款" updated="2026年9月">x</LegalPage>, { locale: "zh" });
    expect(screen.getByRole("link", { name: zh["landing.legal.backToRegistration"] })).toHaveAttribute("href", "/register");
  });
});
