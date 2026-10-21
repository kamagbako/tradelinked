import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithIntl } from "@tests/helpers/utils";

const logError = vi.fn();
vi.mock("@/lib/logger", () => ({ logError: (...args: unknown[]) => logError(...args), logWarn: vi.fn() }));

import RootError from "@/app/error";

beforeEach(() => logError.mockClear());

describe("app/error.tsx", () => {
  it("renders the shared error view with the app-scope home link", () => {
    renderWithIntl(<RootError error={new Error("x")} reset={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByRole("link", { name: "Go to home page" })).toHaveAttribute("href", "/");
  });

  it("logs under the route:app scope with the digest", () => {
    const error = Object.assign(new Error("x"), { digest: "dg" });
    renderWithIntl(<RootError error={error} reset={vi.fn()} />);
    expect(logError).toHaveBeenCalledWith("route:app", error, { digest: "dg" });
    expect(screen.getByText("Reference: dg")).toBeInTheDocument();
  });

  it("wires reset to the Try again button", async () => {
    const reset = vi.fn();
    const { user } = renderWithIntl(<RootError error={new Error("x")} reset={reset} />);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("centres the view on a full-height page", () => {
    const { container } = renderWithIntl(<RootError error={new Error("x")} reset={vi.fn()} />);
    expect(container.firstChild).toHaveClass("min-h-screen", "items-center", "justify-center");
  });
});
