import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithIntl } from "@tests/helpers/utils";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }) }));
vi.mock("@/lib/actions/locale", () => ({ setLocale: vi.fn(async () => {}) }));

import { AuthCard } from "@/components/auth/AuthCard";

function renderCard(props: Partial<React.ComponentProps<typeof AuthCard>> = {}) {
  return renderWithIntl(
    <AuthCard title="Welcome" subtitle="Sign in below" footer={<span>Footer text</span>} {...props}>
      <p>Card body</p>
    </AuthCard>,
  );
}

describe("AuthCard", () => {
  it("renders the title as the page heading", () => {
    renderCard();
    expect(screen.getByRole("heading", { level: 1, name: "Welcome" })).toBeInTheDocument();
  });

  it("renders the subtitle, children and footer", () => {
    renderCard();
    expect(screen.getByText("Sign in below")).toBeInTheDocument();
    expect(screen.getByText("Card body")).toBeInTheDocument();
    expect(screen.getByText("Footer text")).toBeInTheDocument();
  });

  it("renders rich footer content such as links", () => {
    renderCard({ footer: <a href="/register">Register</a> });
    expect(screen.getByRole("link", { name: "Register" })).toHaveAttribute("href", "/register");
  });

  it("allows block content such as a <form> in the footer without invalid DOM nesting", () => {
    // Regression: the footer used to be wrapped in a <p>, so a <form> footer caused a hydration error.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    renderCard({
      footer: (
        <form action="/logout">
          <button type="submit">Use a different account</button>
        </form>
      ),
    });
    const button = screen.getByRole("button", { name: "Use a different account" });
    expect(button.closest("p")).toBeNull();
    const nestingWarnings = consoleError.mock.calls.filter((call) => String(call[0]).includes("cannot be a descendant"));
    expect(nestingWarnings).toHaveLength(0);
  });

  it("renders a brand link back to the home page", () => {
    renderCard();
    expect(screen.getByRole("link", { name: "TradeLinked" })).toHaveAttribute("href", "/");
  });

  it("offers the language switcher and theme toggle", () => {
    renderCard();
    expect(screen.getByRole("button", { name: /^Language:/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle light and dark mode" })).toBeInTheDocument();
  });

  it("orders title, subtitle, children then footer", () => {
    renderCard();
    const heading = screen.getByRole("heading", { name: "Welcome" });
    const card = heading.parentElement!;
    const text = card.textContent ?? "";
    expect(text.indexOf("Welcome")).toBeLessThan(text.indexOf("Sign in below"));
    expect(text.indexOf("Sign in below")).toBeLessThan(text.indexOf("Card body"));
    expect(text.indexOf("Card body")).toBeLessThan(text.indexOf("Footer text"));
  });

  it("keeps the children inside the card, not in the toolbar", () => {
    renderCard();
    const card = screen.getByRole("heading", { name: "Welcome" }).parentElement!;
    expect(within(card).getByText("Card body")).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: /^Language:/ })).not.toBeInTheDocument();
  });

  it("keeps the layout centred on a full-height page", () => {
    const { container } = renderCard();
    expect(container.firstChild).toHaveClass("min-h-screen", "items-center", "justify-center");
  });
});
