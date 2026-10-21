import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act } from "@testing-library/react";
import { TradingViewScreener } from "@/components/dashboard/TradingViewScreener";
import { renderWithIntl } from "@tests/helpers/utils";

const SRC = "https://s3.tradingview.com/external-embedding/embed-widget-screener.js";

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

describe("TradingViewScreener", () => {
  it("injects the screener embed script", () => {
    const { container } = renderWithIntl(<TradingViewScreener />);
    const script = scriptOf(container);
    expect(script.src).toBe(SRC);
    expect(script.async).toBe(true);
  });

  it("adds the widget mount div", () => {
    const { container } = renderWithIntl(<TradingViewScreener />);
    expect(container.querySelector(".tradingview-widget-container > .tradingview-widget-container__widget")).toBeInTheDocument();
  });

  it("configures a coin-level crypto market table in USD", () => {
    const { container } = renderWithIntl(<TradingViewScreener />);
    expect(configOf(container)).toMatchObject({
      width: "100%",
      height: 550,
      defaultColumn: "overview",
      screener_type: "crypto_mkt",
      displayCurrency: "USD",
      isTransparent: false,
    });
  });

  it("uses the dark colour theme by default", () => {
    const { container } = renderWithIntl(<TradingViewScreener />);
    expect(configOf(container).colorTheme).toBe("dark");
  });

  it("uses the light colour theme when the page is light", () => {
    document.documentElement.dataset.theme = "light";
    const { container } = renderWithIntl(<TradingViewScreener />);
    expect(configOf(container).colorTheme).toBe("light");
  });

  it("re-injects a fresh script when the theme changes", async () => {
    const { container } = renderWithIntl(<TradingViewScreener />);
    const before = scriptOf(container);

    await act(async () => {
      document.documentElement.dataset.theme = "light";
    });

    expect(scriptOf(container)).not.toBe(before);
    expect(configOf(container).colorTheme).toBe("light");
    expect(container.querySelectorAll(".tradingview-widget-container__widget")).toHaveLength(1);
  });

  it.each([
    ["en", "en"],
    ["fr", "fr"],
    ["es", "es"],
    ["pt", "br"],
    ["de", "de_DE"],
    ["zh", "zh_CN"],
  ])("maps the %s locale to the TradingView locale %s", (locale, mapped) => {
    const { container } = renderWithIntl(<TradingViewScreener />, { locale });
    expect(configOf(container).locale).toBe(mapped);
  });
});
