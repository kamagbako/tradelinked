import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { GlassCard } from "@/components/ui/GlassCard";

describe("GlassCard", () => {
  it("renders children inside a glass-card container", () => {
    render(<GlassCard data-testid="card">Hello</GlassCard>);
    const card = screen.getByTestId("card");
    expect(card).toHaveTextContent("Hello");
    expect(card).toHaveClass("glass-card", "rounded-2xl", "p-5");
  });

  it("merges a custom className and lets it override padding", () => {
    render(<GlassCard data-testid="card" className="p-10 mt-2">x</GlassCard>);
    const card = screen.getByTestId("card");
    expect(card).toHaveClass("p-10", "mt-2");
    expect(card).not.toHaveClass("p-5");
  });

  it("forwards HTML attributes such as role and aria-label", () => {
    render(
      <GlassCard role="region" aria-label="Summary">
        x
      </GlassCard>,
    );
    expect(screen.getByRole("region", { name: "Summary" })).toBeInTheDocument();
  });

  it("forwards event handlers", () => {
    let clicked = 0;
    render(
      <GlassCard data-testid="card" onClick={() => clicked++}>
        x
      </GlassCard>,
    );
    screen.getByTestId("card").click();
    expect(clicked).toBe(1);
  });

  it("renders as a div", () => {
    render(<GlassCard data-testid="card">x</GlassCard>);
    expect(screen.getByTestId("card").tagName).toBe("DIV");
  });
});
