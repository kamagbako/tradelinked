"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "tradelinked-install-dismissed";

export function InstallPrompt() {
  const t = useTranslations("auth.install");
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      // localStorage unavailable (private mode) — treat as not dismissed.
    }
    if (dismissed) return;

    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // ignore
    }
  }

  async function install() {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    dismiss();
  }

  if (!visible) return null;

  return (
    <GlassCard className="mb-4 flex items-center justify-between gap-3 sm:hidden" role="region" aria-label={t("region")}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
          <Download className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-medium text-text">{t("title")}</p>
          <p className="text-xs text-text-muted">{t("description")}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={install}>{t("install")}</Button>
        <button onClick={dismiss} aria-label={t("dismiss")} className="flex h-11 w-11 items-center justify-center text-text-muted">
          <X className="h-4 w-4" />
        </button>
      </div>
    </GlassCard>
  );
}
