import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { Hero } from "@/components/marketing/Hero";
import { renderWithIntl } from "@tests/helpers/utils";
import { flatten, loadMessages } from "@tests/helpers/messages";

const en = flatten(loadMessages("en"));

describe("Hero", () => {
  it("renders the headline with the highlighted word in its own span", () => {
    renderWithIntl(<Hero />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent("Trade smarter. Grow your portfolio with confidence.");
    const grow = within(h1).getByText("Grow");
    expect(grow.tagName).toBe("SPAN");
    expect(grow).toHaveClass("text-emerald-500");
  });

  it("renders the badge and subtitle", () => {
    renderWithIntl(<Hero />);
    expect(screen.getByText(en["landing.hero.badge"])).toBeInTheDocument();
    expect(screen.getByText(en["landing.hero.subtitle"])).toBeInTheDocument();
  });

  it("links the primary CTA to /register", () => {
    renderWithIntl(<Hero />);
    const link = screen.getByRole("link", { name: /Create Free Account/ });
    expect(link).toHaveAttribute("href", "/register");
  });

  it("links the secondary CTA to the #plans anchor", () => {
    renderWithIntl(<Hero />);
    const link = screen.getByRole("link", { name: /View Investment Plans/ });
    expect(link).toHaveAttribute("href", "#plans");
  });

  it("renders exactly two call-to-action links", () => {
    renderWithIntl(<Hero />);
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it.each([
    ["$48M+", "Assets under management"],
    ["12,000+", "Active traders"],
    ["6.8%", "Avg. monthly ROI"],
  ])("shows the stat %s with label %s", (value, label) => {
    renderWithIntl(<Hero />);
    expect(screen.getByText(value)).toBeInTheDocument();
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("renders French copy", () => {
    const fr = flatten(loadMessages("fr"));
    renderWithIntl(<Hero />, { locale: "fr" });
    expect(screen.getByText(fr["landing.hero.badge"])).toBeInTheDocument();
    expect(screen.getByText(fr["landing.hero.stats.traders"])).toBeInTheDocument();
    expect(screen.getByRole("link", { name: new RegExp(fr["landing.hero.createAccount"]) })).toHaveAttribute(
      "href",
      "/register",
    );
    expect(screen.queryByText(en["landing.hero.badge"])).not.toBeInTheDocument();
  });

  it("renders Chinese copy", () => {
    const zh = flatten(loadMessages("zh"));
    renderWithIntl(<Hero />, { locale: "zh" });
    expect(screen.getByText(zh["landing.hero.subtitle"])).toBeInTheDocument();
    expect(screen.getByRole("link", { name: new RegExp(zh["landing.hero.viewPlans"]) })).toHaveAttribute(
      "href",
      "#plans",
    );
    // the highlighted <grow> chunk is rendered as text, never as a literal tag
    expect(screen.getByRole("heading", { level: 1 }).textContent).not.toMatch(/[<>]/);
  });
});
