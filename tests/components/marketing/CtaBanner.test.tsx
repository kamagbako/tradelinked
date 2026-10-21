import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { CtaBanner } from "@/components/marketing/CtaBanner";
import { renderWithIntl } from "@tests/helpers/utils";
import { flatten, loadMessages } from "@tests/helpers/messages";

describe("CtaBanner", () => {
  it("renders heading, body and a register button", () => {
    renderWithIntl(<CtaBanner />);
    expect(screen.getByRole("heading", { level: 2, name: "Ready to start?" })).toBeInTheDocument();
    expect(screen.getByText("Create your free account today and explore the platform at your own pace.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create Free Account" })).toHaveAttribute("href", "/register");
  });

  it("has a single link", () => {
    renderWithIntl(<CtaBanner />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("renders French copy", () => {
    const fr = flatten(loadMessages("fr"));
    renderWithIntl(<CtaBanner />, { locale: "fr" });
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(fr["landing.cta.heading"]);
    expect(screen.getByRole("link", { name: fr["landing.cta.button"] })).toHaveAttribute("href", "/register");
  });

  it("renders Chinese copy", () => {
    const zh = flatten(loadMessages("zh"));
    renderWithIntl(<CtaBanner />, { locale: "zh" });
    expect(screen.getByText(zh["landing.cta.body"])).toBeInTheDocument();
  });
});
