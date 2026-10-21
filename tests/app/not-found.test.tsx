import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-intl/server", async () => (await import("@tests/helpers/utils")).nextIntlServerMock());

import NotFound from "@/app/not-found";

describe("app/not-found.tsx", () => {
  it("renders the 404 code and translated heading and description", async () => {
    render(await NotFound());
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByText("The page you're looking for doesn't exist or has moved.")).toBeInTheDocument();
  });

  it("links back to the home page", async () => {
    render(await NotFound());
    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/");
  });

  it("renders the back-home action as a button inside the link", async () => {
    render(await NotFound());
    expect(screen.getByRole("link")).toContainElement(screen.getByRole("button", { name: "Back to home" }));
  });

  it("is a full-height centred page", async () => {
    const { container } = render(await NotFound());
    expect(container.firstChild).toHaveClass("min-h-screen", "items-center", "justify-center");
  });

  it("is an async server component (returns a promise)", () => {
    expect(NotFound()).toBeInstanceOf(Promise);
  });
});
