"use client";

import { useEffect } from "react";
import { logError } from "@/lib/logger";

// Replaces the root layout when it itself fails, so it can't rely on providers, Tailwind tokens or
// translations — it is deliberately self-contained (inline styles, English copy).
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logError("route:global", error, { digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#080c14",
          color: "#e2e8f0",
          fontFamily: "system-ui, sans-serif",
          padding: 16,
          textAlign: "center",
        }}
      >
        <div role="alert" style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ color: "#94a3b8", margin: "0 0 20px", fontSize: 14 }}>
            TradeLinked hit an unexpected problem. Please try again.
            {error.digest ? ` (Reference: ${error.digest})` : ""}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ background: "#3b82f6", color: "#fff", border: 0, borderRadius: 12, padding: "12px 20px", fontSize: 14, cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
