import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "@/components/ui/Badge";

describe("Badge", () => {
  it("renders its children", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("uses the neutral tone by default", () => {
    render(<Badge>Neutral</Badge>);
    expect(screen.getByText("Neutral")).toHaveClass("text-text-muted");
  });

  it.each([
    ["success", "text-emerald-400"],
    ["warning", "text-amber-400"],
    ["danger", "text-red-400"],
    ["info", "text-blue-400"],
    ["neutral", "text-text-muted"],
  ] as const)("applies %s tone classes", (tone, cls) => {
    render(<Badge tone={tone}>Label</Badge>);
    expect(screen.getByText("Label")).toHaveClass(cls);
  });

  it("only applies its own tone (not another tone's colour)", () => {
    render(<Badge tone="success">OK</Badge>);
    const badge = screen.getByText("OK");
    expect(badge).not.toHaveClass("text-red-400");
    expect(badge).not.toHaveClass("text-amber-400");
  });

  it("renders as an inline pill", () => {
    render(<Badge>Pill</Badge>);
    expect(screen.getByText("Pill")).toHaveClass("inline-flex", "rounded-full");
  });

  it("supports rich children", () => {
    render(
      <Badge tone="info">
        <strong>Bold</strong> text
      </Badge>,
    );
    expect(screen.getByText("Bold").tagName).toBe("STRONG");
  });
});
