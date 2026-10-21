import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { SecurityFeatures } from "@/components/marketing/SecurityFeatures";
import { renderWithIntl } from "@tests/helpers/utils";
import { flatten, loadMessages } from "@tests/helpers/messages";

const en = flatten(loadMessages("en"));
const IDS = ["encryption", "custody", "auth", "audit"] as const;

describe("SecurityFeatures", () => {
  it("is the #security anchor target", () => {
    const { container } = renderWithIntl(<SecurityFeatures />);
    expect(container.querySelector("section#security")).toBeInTheDocument();
  });

  it("renders heading and subtitle", () => {
    renderWithIntl(<SecurityFeatures />);
    expect(screen.getByRole("heading", { level: 2, name: "Built on Security" })).toBeInTheDocument();
    expect(screen.getByText("Your capital and data are protected at every layer.")).toBeInTheDocument();
  });

  it("renders four feature cards in order", () => {
    renderWithIntl(<SecurityFeatures />);
    const titles = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(titles).toEqual(IDS.map((id) => en[`landing.security.features.${id}.title`]));
  });

  it.each(IDS)("renders the %s description", (id) => {
    renderWithIntl(<SecurityFeatures />);
    expect(screen.getByText(en[`landing.security.features.${id}.description`])).toBeInTheDocument();
  });

  it("renders French copy", () => {
    const fr = flatten(loadMessages("fr"));
    renderWithIntl(<SecurityFeatures />, { locale: "fr" });
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(fr["landing.security.heading"]);
    expect(screen.getByText(fr["landing.security.features.audit.description"])).toBeInTheDocument();
  });

  it("renders Chinese copy", () => {
    const zh = flatten(loadMessages("zh"));
    renderWithIntl(<SecurityFeatures />, { locale: "zh" });
    expect(screen.getByRole("heading", { name: zh["landing.security.features.custody.title"] })).toBeInTheDocument();
    expect(screen.queryByText("Segregated custody")).not.toBeInTheDocument();
  });
});
