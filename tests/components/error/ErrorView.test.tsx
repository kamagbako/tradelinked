import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithIntl } from "@tests/helpers/utils";

const logError = vi.fn();
vi.mock("@/lib/logger", () => ({ logError: (...args: unknown[]) => logError(...args), logWarn: vi.fn() }));

import { ErrorView } from "@/components/error/ErrorView";

function makeError(message = "boom", digest?: string) {
  return Object.assign(new Error(message), digest ? { digest } : {});
}

beforeEach(() => {
  logError.mockClear();
});

describe("ErrorView", () => {
  it("renders an alert with the title and description", () => {
    renderWithIntl(<ErrorView error={makeError()} reset={vi.fn()} scope="app" />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Something went wrong");
    expect(alert).toHaveTextContent("An unexpected error occurred. You can try again, or head back to a safe page.");
  });

  it("does not leak the raw error message to the user", () => {
    renderWithIntl(<ErrorView error={makeError("secret internal detail")} reset={vi.fn()} scope="app" />);
    expect(screen.queryByText(/secret internal detail/)).not.toBeInTheDocument();
  });

  it("shows no reference line when there is no digest", () => {
    renderWithIntl(<ErrorView error={makeError()} reset={vi.fn()} scope="app" />);
    expect(screen.queryByText(/Reference:/)).not.toBeInTheDocument();
  });

  it("shows the reference line when a digest is present", () => {
    renderWithIntl(<ErrorView error={makeError("x", "abc123")} reset={vi.fn()} scope="app" />);
    expect(screen.getByText("Reference: abc123")).toBeInTheDocument();
  });

  it("calls reset when Try again is clicked", async () => {
    const reset = vi.fn();
    const { user } = renderWithIntl(<ErrorView error={makeError()} reset={reset} scope="app" />);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("does not call reset on render", () => {
    const reset = vi.fn();
    renderWithIntl(<ErrorView error={makeError()} reset={reset} scope="app" />);
    expect(reset).not.toHaveBeenCalled();
  });

  it.each([
    ["app", "Go to home page", "/"],
    ["dashboard", "Go to dashboard", "/dashboard"],
    ["admin", "Go to admin overview", "/admin"],
  ] as const)("the %s scope links to %s (%s)", (scope, label, href) => {
    renderWithIntl(<ErrorView error={makeError()} reset={vi.fn()} scope={scope} />);
    const link = screen.getByRole("link", { name: label });
    expect(link).toHaveAttribute("href", href);
  });

  it("only shows the link for its own scope", () => {
    renderWithIntl(<ErrorView error={makeError()} reset={vi.fn()} scope="dashboard" />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByRole("link", { name: "Go to home page" })).not.toBeInTheDocument();
  });

  it("logs the error on mount under the scope with the digest", () => {
    const error = makeError("kaput", "d1");
    renderWithIntl(<ErrorView error={error} reset={vi.fn()} scope="admin" />);
    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith("route:admin", error, { digest: "d1" });
  });

  it("logs with an undefined digest when absent", () => {
    const error = makeError();
    renderWithIntl(<ErrorView error={error} reset={vi.fn()} scope="app" />);
    expect(logError).toHaveBeenCalledWith("route:app", error, { digest: undefined });
  });

  it("logs once per error, not on re-render with the same props", () => {
    const error = makeError();
    const reset = vi.fn();
    const { rerender } = renderWithIntl(<ErrorView error={error} reset={reset} scope="app" />);
    rerender(<ErrorView error={error} reset={reset} scope="app" />);
    expect(logError).toHaveBeenCalledTimes(1);
  });

  it("logs again when a different error arrives", () => {
    const reset = vi.fn();
    const { rerender } = renderWithIntl(<ErrorView error={makeError("a")} reset={reset} scope="app" />);
    rerender(<ErrorView error={makeError("b")} reset={reset} scope="app" />);
    expect(logError).toHaveBeenCalledTimes(2);
  });

  it("is translated", () => {
    renderWithIntl(<ErrorView error={makeError()} reset={vi.fn()} scope="app" />, { locale: "fr" });
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it.each(["MissingEnvError", "InvalidEnvError"])("explains a %s so a misconfigured deployment is diagnosable", (name) => {
    const error = Object.assign(new Error("Missing environment variables: NEXT_PUBLIC_SUPABASE_URL."), { name });
    renderWithIntl(<ErrorView error={error} reset={vi.fn()} scope="app" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Missing environment variables: NEXT_PUBLIC_SUPABASE_URL.");
  });

  it("still hides the message of ordinary errors", () => {
    const error = Object.assign(new Error("db password is hunter2"), { name: "TypeError" });
    renderWithIntl(<ErrorView error={error} reset={vi.fn()} scope="app" />);
    expect(screen.queryByText(/hunter2/)).not.toBeInTheDocument();
  });
});
