"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "next-intl";
import { useTheme } from "@/lib/theme";

const TV_LOCALES: Record<string, string> = { en: "en", fr: "fr", es: "es", pt: "br", de: "de_DE", zh: "zh_CN" };

export function TradingViewScreener() {
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const locale = useLocale();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";
    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    container.appendChild(widgetDiv);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-screener.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      width: "100%",
      height: 550,
      defaultColumn: "overview",
      // Coin-level market table (Bitcoin, Ethereum… with price, market cap, supply, 24h change)
      // rather than the exchange trading-pair screener that lists contracts like BTCUSDT.P.
      screener_type: "crypto_mkt",
      displayCurrency: "USD",
      colorTheme: theme,
      locale: TV_LOCALES[locale] ?? "en",
      isTransparent: false,
    });
    container.appendChild(script);
  }, [theme, locale]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div ref={containerRef} className="tradingview-widget-container" />
    </div>
  );
}
