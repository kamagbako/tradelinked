import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act } from "@testing-library/react";
import { TradingViewChart } from "@/components/dashboard/TradingViewChart";
import { renderWithIntl } from "@tests/helpers/utils";

const SRC = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";

beforeEach(() => {
  document.documentElement.dataset.theme = "dark";
});

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
});

function scriptOf(container: HTMLElement) {
  const scripts = container.querySelectorAll("script");
  expect(scripts).toHaveLength(1);
  return scripts[0];
}

const configOf = (container: HTMLElement) => JSON.parse(scriptOf(container).innerHTML) as Record<string, unknown>;

describe("TradingViewChart", () => {
  it("injects the advanced-chart embed script", () => {
    const { container } = renderWithIntl(<TradingViewChart />);
    const script = scriptOf(container);
    expect(script.src).toBe(SRC);
    expect(script.async).toBe(true);
  });

  it("adds the widget mount div before the script", () => {
    const { container } = renderWithIntl(<TradingViewChart />);
    const host = container.querySelector(".tradingview-widget-container") as HTMLElement;
    expect(host.children[0]).toHaveClass("tradingview-widget-container__widget");
    expect(host.children[1].tagName).toBe("SCRIPT");
  });

  it("configures the default symbol and chart options", () => {
    const { container } = renderWithIntl(<TradingViewChart />);
    expect(configOf(container)).toMatchObject({
      autosize: true,
      symbol: "BINANCE:BTCUSDT",
      interval: "60",
      timezone: "Etc/UTC",
      allow_symbol_change: true,
    });
  });

  it("uses a custom symbol", () => {
    const { container } = renderWithIntl(<TradingViewChart symbol="NASDAQ:AAPL" />);
    expect(configOf(container).symbol).toBe("NASDAQ:AAPL");
  });

  it("uses the dark theme colours by default", () => {
    const { container } = renderWithIntl(<TradingViewChart />);
    expect(configOf(container)).toMatchObject({ theme: "dark", backgroundColor: "#0f172a" });
  });

  it("uses the light theme colours when the page is light", () => {
    document.documentElement.dataset.theme = "light";
    const { container } = renderWithIntl(<TradingViewChart />);
    expect(configOf(container)).toMatchObject({ theme: "light", backgroundColor: "#ffffff" });
  });

  it("re-injects a fresh script with the new theme when the theme changes", async () => {
    const { container } = renderWithIntl(<TradingViewChart />);
    const before = scriptOf(container);
    expect(configOf(container).theme).toBe("dark");

    await act(async () => {
      document.documentElement.dataset.theme = "light";
    });

    const after = scriptOf(container);
    expect(after).not.toBe(before);
    expect(after.src).toBe(SRC);
    expect(configOf(container)).toMatchObject({ theme: "light", backgroundColor: "#ffffff" });
    expect(container.querySelectorAll(".tradingview-widget-container__widget")).toHaveLength(1);
  });

  it("re-injects again when switching back to dark", async () => {
    document.documentElement.dataset.theme = "light";
    const { container } = renderWithIntl(<TradingViewChart />);
    await act(async () => {
      document.documentElement.dataset.theme = "dark";
    });
    expect(configOf(container).theme).toBe("dark");
  });

  it("re-injects when the symbol prop changes", () => {
    const { container, rerender } = renderWithIntl(<TradingViewChart symbol="BINANCE:BTCUSDT" />);
    const before = scriptOf(container);
    rerender(<TradingViewChart symbol="BINANCE:ETHUSDT" />);
    expect(scriptOf(container)).not.toBe(before);
    expect(configOf(container).symbol).toBe("BINANCE:ETHUSDT");
  });

  it.each([
    ["en", "en"],
    ["fr", "fr"],
    ["es", "es"],
    ["pt", "br"],
    ["de", "de_DE"],
    ["zh", "zh_CN"],
  ])("maps the %s locale to the TradingView locale %s", (locale, mapped) => {
    const { container } = renderWithIntl(<TradingViewChart />, { locale });
    expect(configOf(container).locale).toBe(mapped);
  });
});
