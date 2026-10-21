import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithIntl } from "@tests/helpers/utils";

const logError = vi.fn();
vi.mock("@/lib/logger", () => ({ logError: (...args: unknown[]) => logError(...args), logWarn: vi.fn() }));

import DashboardError from "@/app/dashboard/error";

beforeEach(() => logError.mockClear());

describe("app/dashboard/error.tsx", () => {
  it("renders the shared error view with the dashboard link", () => {
    renderWithIntl(<DashboardError error={new Error("x")} reset={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByRole("link", { name: "Go to dashboard" })).toHaveAttribute("href", "/dashboard");
  });

  it("logs under the route:dashboard scope", () => {
    const error = Object.assign(new Error("x"), { digest: "dg" });
    renderWithIntl(<DashboardError error={error} reset={vi.fn()} />);
    expect(logError).toHaveBeenCalledWith("route:dashboard", error, { digest: "dg" });
  });

  it("wires reset to the Try again button", async () => {
    const reset = vi.fn();
    const { user } = renderWithIntl(<DashboardError error={new Error("x")} reset={reset} />);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
