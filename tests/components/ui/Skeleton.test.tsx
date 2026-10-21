import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { CardSkeleton, Skeleton } from "@/components/ui/Skeleton";

describe("Skeleton", () => {
  it("renders a pulsing placeholder block", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass("animate-pulse", "rounded-lg");
  });

  it("merges a custom className", () => {
    const { container } = render(<Skeleton className="h-4 w-24" />);
    expect(container.firstChild).toHaveClass("animate-pulse", "h-4", "w-24");
  });

  it("has no text content and is not interactive", () => {
    const { container } = render(<Skeleton />);
    expect(container).toHaveTextContent("");
    expect(container.querySelector("button, a, input")).toBeNull();
  });
});

describe("CardSkeleton", () => {
  it("renders a glass card containing two skeleton lines", () => {
    const { container } = render(<CardSkeleton />);
    expect(container.firstChild).toHaveClass("glass-card");
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(2);
  });
});
