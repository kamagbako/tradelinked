import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { AboutSection } from "@/components/marketing/AboutSection";
import { renderWithIntl } from "@tests/helpers/utils";
import { flatten, loadMessages } from "@tests/helpers/messages";

const en = flatten(loadMessages("en"));

describe("AboutSection", () => {
  it("is the #about anchor target", () => {
    const { container } = renderWithIntl(<AboutSection />);
    expect(container.querySelector("section#about")).toBeInTheDocument();
  });

  it("renders the heading with the brand highlighted", () => {
    renderWithIntl(<AboutSection />);
    const h2 = screen.getByRole("heading", { level: 2, name: /About TradeLinked/ });
    const brand = within(h2).getByText("TradeLinked");
    expect(brand.tagName).toBe("SPAN");
    expect(brand).toHaveClass("text-emerald-500");
  });

  it.each(["whoWeAre", "lead", "body", "disclaimer", "chartCaption", "thisMonth", "anywhereBody", "installable"])(
    "renders the %s copy",
    (key) => {
      renderWithIntl(<AboutSection />);
      expect(screen.getByText(en[`landing.about.${key}`])).toBeInTheDocument();
    },
  );

  it("renders both feature cards", () => {
    renderWithIntl(<AboutSection />);
    expect(screen.getByRole("heading", { level: 3, name: "Fast progress" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "A modern platform" })).toBeInTheDocument();
    expect(screen.getByText(en["landing.about.fastProgress.body"])).toBeInTheDocument();
    expect(screen.getByText(en["landing.about.modernPlatform.body"])).toBeInTheDocument();
  });

  it("renders the secondary heading and sample chart figure", () => {
    renderWithIntl(<AboutSection />);
    expect(
      screen.getByRole("heading", { level: 2, name: "Access and manage all your investments from anywhere" }),
    ).toBeInTheDocument();
    expect(screen.getByText("+$1,284.50")).toBeInTheDocument();
  });

  it("links Explore plans to #plans and Get started to /register", () => {
    renderWithIntl(<AboutSection />);
    expect(screen.getByRole("link", { name: "Explore plans" })).toHaveAttribute("href", "#plans");
    expect(screen.getByRole("link", { name: "Get started" })).toHaveAttribute("href", "/register");
  });

  it("hides the decorative chart svg from assistive tech", () => {
    const { container } = renderWithIntl(<AboutSection />);
    expect(container.querySelector("svg[viewBox='0 0 600 220']")).toHaveAttribute("aria-hidden", "true");
  });

  it("renders French copy", () => {
    const fr = flatten(loadMessages("fr"));
    renderWithIntl(<AboutSection />, { locale: "fr" });
    expect(screen.getByText(fr["landing.about.lead"])).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: fr["landing.about.fastProgress.title"] })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: fr["landing.about.getStarted"] })).toHaveAttribute("href", "/register");
  });

  it("renders Chinese copy", () => {
    const zh = flatten(loadMessages("zh"));
    renderWithIntl(<AboutSection />, { locale: "zh" });
    expect(screen.getByText(zh["landing.about.body"])).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: zh["landing.about.anywhereHeading"] })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: zh["landing.about.modernPlatform.explorePlans"] })).toHaveAttribute(
      "href",
      "#plans",
    );
  });
});
