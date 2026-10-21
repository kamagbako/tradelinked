"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "next-intl";
import { useTheme } from "@/lib/theme";

declare global {
  interface Window {
    TradingView?: unknown;
  }
}

const TV_LOCALES: Record<string, string> = { en: "en", fr: "fr", es: "es", pt: "br", de: "de_DE", zh: "zh_CN" };

export function TradingViewChart({ symbol = "BINANCE:BTCUSDT" }: { symbol?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const locale = useLocale();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";
    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    widgetDiv.style.height = "100%";
    widgetDiv.style.width = "100%";
    container.appendChild(widgetDiv);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval: "60",
      timezone: "Etc/UTC",
      theme,
      style: "1",
      locale: TV_LOCALES[locale] ?? "en",
      backgroundColor: theme === "light" ? "#ffffff" : "#0f172a",
      gridColor: theme === "light" ? "rgba(226, 232, 240, 0.8)" : "rgba(30, 41, 59, 0.6)",
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: true,
      support_host: "https://www.tradingview.com",
    });
    container.appendChild(script);
  }, [symbol, theme, locale]);

  return (
    <div className="h-[420px] w-full overflow-hidden rounded-2xl border border-border bg-surface sm:h-[520px]">
      <div ref={containerRef} className="tradingview-widget-container h-full w-full" />
    </div>
  );
}
