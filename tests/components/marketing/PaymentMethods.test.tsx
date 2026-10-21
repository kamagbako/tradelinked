import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { PaymentMethods } from "@/components/marketing/PaymentMethods";
import { renderWithIntl } from "@tests/helpers/utils";
import { flatten, loadMessages } from "@tests/helpers/messages";

const METHODS = ["Bitcoin", "Tether TRC-20", "Tether BEP-20", "BNB", "TRX", "Litecoin", "Bank transfer"];

describe("PaymentMethods", () => {
  it("is the #payments anchor target", () => {
    const { container } = renderWithIntl(<PaymentMethods />);
    expect(container.querySelector("section#payments")).toBeInTheDocument();
  });

  it("renders heading and subtitle", () => {
    renderWithIntl(<PaymentMethods />);
    expect(screen.getByRole("heading", { level: 2, name: "Accepted payment methods" })).toBeInTheDocument();
    expect(screen.getByText(/exact deposit details are shown securely inside your dashboard/)).toBeInTheDocument();
  });

  it.each(METHODS)("lists the %s method", (name) => {
    renderWithIntl(<PaymentMethods />);
    expect(screen.getByText(name)).toBeInTheDocument();
  });

  it("lists exactly seven methods, in order", () => {
    const { container } = renderWithIntl(<PaymentMethods />);
    const names = Array.from(container.querySelectorAll("span.text-sm.font-medium")).map((n) => n.textContent);
    expect(names).toEqual(METHODS);
  });

  it("hides the decorative glyph badges from assistive tech", () => {
    const { container } = renderWithIntl(<PaymentMethods />);
    const badges = container.querySelectorAll("span[aria-hidden='true']");
    expect(badges).toHaveLength(7);
    expect(badges[0]).toHaveTextContent("₿");
  });

  it("translates the bank transfer label", () => {
    const zh = flatten(loadMessages("zh"));
    renderWithIntl(<PaymentMethods />, { locale: "zh" });
    expect(screen.getByText(zh["landing.payments.bankTransfer"])).toBeInTheDocument();
    expect(screen.queryByText("Bank transfer")).not.toBeInTheDocument();
    // crypto brand names stay untranslated
    expect(screen.getByText("Bitcoin")).toBeInTheDocument();
  });

  it("renders French heading", () => {
    const fr = flatten(loadMessages("fr"));
    renderWithIntl(<PaymentMethods />, { locale: "fr" });
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(fr["landing.payments.heading"]);
    expect(screen.getByText(fr["landing.payments.bankTransfer"])).toBeInTheDocument();
  });
});
