import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import TermsPage, { generateMetadata } from "@/app/terms/page";
import { flatten, loadMessages } from "@tests/helpers/messages";
import { renderWithIntl } from "@tests/helpers/utils";

vi.mock("next-intl/server", async () => (await import("@tests/helpers/utils")).nextIntlServerMock());
vi.mock("@/components/layout/Navbar", () => ({ Navbar: () => <nav data-testid="navbar" /> }));

const en = flatten(loadMessages("en"));
const SECTIONS = ["acceptance", "account", "transactions", "restrictions", "changes"];

async function renderPage() {
  return renderWithIntl(await TermsPage());
}

describe("TermsPage", () => {
  it("sets the document title from the translated page title", async () => {
    expect(await generateMetadata()).toEqual({ title: en["landing.legal.terms.title"] });
  });

  it("renders the title as the h1", async () => {
    await renderPage();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(en["landing.legal.terms.title"]);
  });

  it("shows the last-updated date", async () => {
    await renderPage();
    expect(screen.getByText(`Last updated ${en["landing.legal.updated"]}`)).toBeInTheDocument();
  });

  it("renders all ${SECTIONS.length} sections in order as h2 headings", async () => {
    await renderPage();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(SECTIONS.map((id) => en[`landing.legal.terms.sections.${id}.heading`]));
  });

  it.each(SECTIONS)("renders the heading and body of the %s section together", async (id) => {
    await renderPage();
    const heading = screen.getByRole("heading", { level: 2, name: en[`landing.legal.terms.sections.${id}.heading`] });
    const section = heading.closest("section")!;
    expect(within(section).getByText(en[`landing.legal.terms.sections.${id}.body`])).toBeInTheDocument();
  });

  it("links back to registration and shows the site footer", async () => {
    await renderPage();
    expect(screen.getByRole("link", { name: "Back to registration" })).toHaveAttribute("href", "/register");
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("does not leave any untranslated message keys on the page", async () => {
    const { container } = await renderPage();
    expect(container.textContent).not.toMatch(/landing\.legal/);
  });
});
