import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { renderWithIntl } from "@tests/helpers/utils";
import { flatten, loadMessages } from "@tests/helpers/messages";

const en = flatten(loadMessages("en"));
const STEP_IDS = ["create", "fund", "activate", "withdraw"] as const;

describe("HowItWorks", () => {
  it("is the #how-it-works anchor target", () => {
    const { container } = renderWithIntl(<HowItWorks />);
    expect(container.querySelector("section#how-it-works")).toBeInTheDocument();
  });

  it("renders the heading and subtitle", () => {
    renderWithIntl(<HowItWorks />);
    expect(screen.getByRole("heading", { level: 2, name: "How TradeLinked works" })).toBeInTheDocument();
    expect(screen.getByText(en["landing.howItWorks.subtitle"])).toBeInTheDocument();
  });

  it("renders four steps as h3 headings in order", () => {
    renderWithIntl(<HowItWorks />);
    const titles = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(titles).toEqual(STEP_IDS.map((id) => en[`landing.howItWorks.steps.${id}.title`]));
  });

  it.each([1, 2, 3, 4])("labels step %i with its number", (step) => {
    renderWithIntl(<HowItWorks />);
    expect(screen.getByText(`Step ${step}.`)).toBeInTheDocument();
  });

  it("shows the large decorative step numerals 1 to 4", () => {
    const { container } = renderWithIntl(<HowItWorks />);
    const numerals = Array.from(container.querySelectorAll("span.text-6xl")).map((n) => n.textContent);
    expect(numerals).toEqual(["1", "2", "3", "4"]);
  });

  it.each(STEP_IDS)("renders the body copy for the %s step", (id) => {
    renderWithIntl(<HowItWorks />);
    expect(screen.getByText(en[`landing.howItWorks.steps.${id}.body`])).toBeInTheDocument();
  });

  it("renders French copy", () => {
    const fr = flatten(loadMessages("fr"));
    renderWithIntl(<HowItWorks />, { locale: "fr" });
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(fr["landing.howItWorks.heading"]);
    expect(screen.getByRole("heading", { name: fr["landing.howItWorks.steps.fund.title"] })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(4);
  });

  it("renders Chinese step labels with the step number interpolated", () => {
    const zh = flatten(loadMessages("zh"));
    const { container } = renderWithIntl(<HowItWorks />, { locale: "zh" });
    const labels = Array.from(container.querySelectorAll("p.font-medium")).map((p) => p.textContent);
    expect(labels).toHaveLength(4);
    labels.forEach((label, i) => {
      expect(label).toBe(zh["landing.howItWorks.stepLabel"].replace("{step}", String(i + 1)));
    });
    const card = screen.getByRole("heading", { name: zh["landing.howItWorks.steps.create.title"] }).parentElement!;
    expect(within(card).getByText(zh["landing.howItWorks.steps.create.body"])).toBeInTheDocument();
  });
});
