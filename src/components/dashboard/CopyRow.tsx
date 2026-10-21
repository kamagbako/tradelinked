"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function CopyRow({ label, value, className }: { label: string; value: string; className?: string }) {
  const t = useTranslations("dashboard");
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — no-op.
    }
  }

  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-xl border border-border bg-bg px-3.5 py-3", className)}>
      <div className="min-w-0">
        <p className="text-xs text-text-muted">{label}</p>
        <p className="truncate text-sm text-text">{value}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={t("copyRow.copy", { label })}
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-hover hover:text-text"
      >
        {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}
