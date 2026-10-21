import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@tests/helpers/utils";

const logError = vi.fn();
vi.mock("@/lib/logger", () => ({ logError: (...args: unknown[]) => logError(...args), logWarn: vi.fn() }));

import GlobalError from "@/app/global-error";

beforeEach(() => {
  logError.mockClear();
  // <html>/<body> inside a div container is invalid DOM nesting; React warns about it in jsdom only.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("app/global-error.tsx", () => {
  it("renders a self-contained English alert without any intl provider", () => {
    render(<GlobalError error={new Error("x")} reset={vi.fn()} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Something went wrong");
    expect(alert).toHaveTextContent("TradeLinked hit an unexpected problem. Please try again.");
  });

  it("has a top-level heading", () => {
    render(<GlobalError error={new Error("x")} reset={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1, name: "Something went wrong" })).toBeInTheDocument();
  });

  it("omits the reference when there is no digest", () => {
    render(<GlobalError error={new Error("x")} reset={vi.fn()} />);
    expect(screen.queryByText(/Reference:/)).not.toBeInTheDocument();
  });

  it("shows the reference when a digest is present", () => {
    render(<GlobalError error={Object.assign(new Error("x"), { digest: "zz9" })} reset={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("(Reference: zz9)");
  });

  it("calls reset when Try again is clicked", async () => {
    const reset = vi.fn();
    render(<GlobalError error={new Error("x")} reset={reset} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("uses a non-submitting button", () => {
    render(<GlobalError error={new Error("x")} reset={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Try again" })).toHaveAttribute("type", "button");
  });

  it("logs the error under route:global with the digest", () => {
    const error = Object.assign(new Error("root failed"), { digest: "d0" });
    render(<GlobalError error={error} reset={vi.fn()} />);
    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith("route:global", error, { digest: "d0" });
  });

  it("does not leak the raw error message", () => {
    render(<GlobalError error={new Error("db password is hunter2")} reset={vi.fn()} />);
    expect(screen.queryByText(/hunter2/)).not.toBeInTheDocument();
  });
});
