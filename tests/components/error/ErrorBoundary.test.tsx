import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderWithIntl } from "@tests/helpers/utils";

const logError = vi.fn();
vi.mock("@/lib/logger", () => ({ logError: (...args: unknown[]) => logError(...args), logWarn: vi.fn() }));

import { ErrorBoundary, WidgetBoundary } from "@/components/error/ErrorBoundary";

// A controllable failure so we can "fix the cause" before hitting reset.
const control = { shouldThrow: true };

function Bomb({ message = "kaboom" }: { message?: string }) {
  if (control.shouldThrow) throw new Error(message);
  return <p>All good</p>;
}

beforeEach(() => {
  control.shouldThrow = true;
  logError.mockClear();
  // React logs caught render errors; keep test output clean.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  control.shouldThrow = true;
});

describe("ErrorBoundary", () => {
  it("renders children when nothing throws", () => {
    control.shouldThrow = false;
    render(
      <ErrorBoundary fallback={<p>fallback</p>}>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText("All good")).toBeInTheDocument();
    expect(screen.queryByText("fallback")).not.toBeInTheDocument();
    expect(logError).not.toHaveBeenCalled();
  });

  it("shows a static fallback node when a child throws", () => {
    render(
      <ErrorBoundary fallback={<p>fallback node</p>}>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText("fallback node")).toBeInTheDocument();
    expect(screen.queryByText("All good")).not.toBeInTheDocument();
  });

  it("renders nothing when fallback is null", () => {
    const { container } = render(
      <ErrorBoundary fallback={null}>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when no fallback is provided", () => {
    const { container } = render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("calls a render-function fallback with the error and a reset callback", () => {
    const fallback = vi.fn(({ error }: { error: Error; reset: () => void }) => <p>Failed: {error.message}</p>);
    render(
      <ErrorBoundary fallback={fallback}>
        <Bomb message="specific failure" />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Failed: specific failure")).toBeInTheDocument();
    const args = fallback.mock.calls[0][0];
    expect(args.error).toBeInstanceOf(Error);
    expect(args.error.message).toBe("specific failure");
    expect(typeof args.reset).toBe("function");
  });

  it("re-renders children after reset once the cause is fixed", async () => {
    const { user } = renderWithIntl(
      <ErrorBoundary
        fallback={({ reset }) => (
          <button type="button" onClick={reset}>
            Retry
          </button>
        )}
      >
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();

    control.shouldThrow = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(screen.getByText("All good")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("shows the fallback again if the child still throws after reset", async () => {
    const { user } = renderWithIntl(
      <ErrorBoundary
        fallback={({ reset }) => (
          <button type="button" onClick={reset}>
            Retry
          </button>
        )}
      >
        <Bomb />
      </ErrorBoundary>,
    );
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(logError).toHaveBeenCalledTimes(2);
  });

  it("calls onError with the error and component stack info", () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary fallback={null} onError={onError}>
        <Bomb message="oops" />
      </ErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledTimes(1);
    const [error, info] = onError.mock.calls[0];
    expect((error as Error).message).toBe("oops");
    expect(typeof (info as { componentStack: string }).componentStack).toBe("string");
  });

  it("does not require onError", () => {
    expect(() =>
      render(
        <ErrorBoundary fallback={<p>x</p>}>
          <Bomb />
        </ErrorBoundary>,
      ),
    ).not.toThrow();
  });

  it("logs the error under the boundary's name", () => {
    render(
      <ErrorBoundary name="chart" fallback={null}>
        <Bomb message="chart broke" />
      </ErrorBoundary>,
    );
    expect(logError).toHaveBeenCalledTimes(1);
    const [scope, error, context] = logError.mock.calls[0];
    expect(scope).toBe("boundary:chart");
    expect((error as Error).message).toBe("chart broke");
    expect(context).toHaveProperty("componentStack");
  });

  it("uses 'unnamed' when no name is given", () => {
    render(
      <ErrorBoundary fallback={null}>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(logError.mock.calls[0][0]).toBe("boundary:unnamed");
  });

  it("only catches errors in its own subtree", () => {
    render(
      <div>
        <ErrorBoundary fallback={<p>contained</p>}>
          <Bomb />
        </ErrorBoundary>
        <p>sibling stays</p>
      </div>,
    );
    expect(screen.getByText("contained")).toBeInTheDocument();
    expect(screen.getByText("sibling stays")).toBeInTheDocument();
  });

  it("nested boundaries: the innermost one handles the error", () => {
    render(
      <ErrorBoundary fallback={<p>outer</p>}>
        <ErrorBoundary fallback={<p>inner</p>}>
          <Bomb />
        </ErrorBoundary>
      </ErrorBoundary>,
    );
    expect(screen.getByText("inner")).toBeInTheDocument();
    expect(screen.queryByText("outer")).not.toBeInTheDocument();
  });

  it("catches errors thrown later by a re-render, keeping earlier state outside the boundary", async () => {
    function Harness() {
      const [count, setCount] = useState(0);
      return (
        <div>
          <button type="button" onClick={() => setCount((c) => c + 1)}>
            inc
          </button>
          <ErrorBoundary fallback={<p>broken</p>}>
            <Counter count={count} />
          </ErrorBoundary>
        </div>
      );
    }
    function Counter({ count }: { count: number }) {
      if (count >= 2) throw new Error("too high");
      return <p>count {count}</p>;
    }
    const { user } = renderWithIntl(<Harness />);
    await user.click(screen.getByRole("button", { name: "inc" }));
    expect(screen.getByText("count 1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "inc" }));
    expect(screen.getByText("broken")).toBeInTheDocument();
  });

  it("reports the failure via console.error (React's own reporting)", () => {
    render(
      <ErrorBoundary fallback={null}>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(console.error).toHaveBeenCalled();
  });
});

describe("WidgetBoundary", () => {
  it("renders children when healthy", () => {
    control.shouldThrow = false;
    renderWithIntl(
      <WidgetBoundary name="ticker">
        <Bomb />
      </WidgetBoundary>,
    );
    expect(screen.getByText("All good")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the translated retry card on failure", () => {
    renderWithIntl(
      <WidgetBoundary name="ticker">
        <Bomb />
      </WidgetBoundary>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("This section couldn't be loaded.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("translates the retry card", () => {
    renderWithIntl(
      <WidgetBoundary name="ticker">
        <Bomb />
      </WidgetBoundary>,
      { locale: "fr" },
    );
    expect(screen.queryByText("This section couldn't be loaded.")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("retry re-renders the widget after the cause is fixed", async () => {
    const { user } = renderWithIntl(
      <WidgetBoundary name="ticker">
        <Bomb />
      </WidgetBoundary>,
    );
    control.shouldThrow = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("All good")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps showing the card if retrying fails again", async () => {
    const { user } = renderWithIntl(
      <WidgetBoundary name="ticker">
        <Bomb />
      </WidgetBoundary>,
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders nothing when silent", () => {
    const { container } = renderWithIntl(
      <WidgetBoundary name="chat" silent>
        <Bomb />
      </WidgetBoundary>,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("still logs when silent", () => {
    renderWithIntl(
      <WidgetBoundary name="chat" silent>
        <Bomb />
      </WidgetBoundary>,
    );
    expect(logError).toHaveBeenCalledWith("boundary:chat", expect.any(Error), expect.anything());
  });

  it("logs with the widget name", () => {
    renderWithIntl(
      <WidgetBoundary name="portfolio-chart">
        <Bomb />
      </WidgetBoundary>,
    );
    expect(logError.mock.calls[0][0]).toBe("boundary:portfolio-chart");
  });

  it("isolates the failure from sibling content", () => {
    renderWithIntl(
      <div>
        <WidgetBoundary name="a">
          <Bomb />
        </WidgetBoundary>
        <p>rest of page</p>
      </div>,
    );
    expect(screen.getByText("rest of page")).toBeInTheDocument();
  });
});
