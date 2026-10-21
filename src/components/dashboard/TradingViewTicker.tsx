"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "next-intl";
import { useTheme } from "@/lib/theme";

const DEFAULT_SYMBOLS = [
  { proName: "BITSTAMP:BTCUSD", title: "Bitcoin" },
  { proName: "BITSTAMP:ETHUSD", title: "Ethereum" },
  { proName: "FOREXCOM:SPXUSD", title: "S&P 500" },
  { proName: "FOREXCOM:NSXUSD", title: "Nasdaq 100" },
  { proName: "FX:EURUSD", title: "EUR/USD" },
];

const TV_LOCALES: Record<string, string> = { en: "en", fr: "fr", es: "es", pt: "br", de: "de_DE", zh: "zh_CN" };

export function TradingViewTicker() {
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
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: DEFAULT_SYMBOLS,
      showSymbolLogo: true,
      colorTheme: theme,
      isTransparent: true,
      displayMode: "adaptive",
      locale: TV_LOCALES[locale] ?? "en",
    });
    container.appendChild(script);
  }, [theme, locale]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div ref={containerRef} className="tradingview-widget-container" />
    </div>
  );
}
