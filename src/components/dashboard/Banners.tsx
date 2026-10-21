"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Layers, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";

/** Prompts for browser-notification permission; disappears once it has been granted. */
export function NotificationBanner() {
  const t = useTranslations("dashboard");
  const [permission, setPermission] = useState<NotificationPermission | "unsupported" | null>(null);

  useEffect(() => {
    setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);

  if (permission === null || permission === "unsupported" || permission === "granted") return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-blue-500/40 bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Bell className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500" />
        <div>
          <p className="text-sm font-semibold text-text">
            {permission === "denied" ? t("banners.notifications.resetTitle") : t("banners.notifications.allowTitle")}
          </p>
          <p className="mt-0.5 text-xs italic text-text-muted">
            {permission === "denied"
              ? t("banners.notifications.deniedBody")
              : t("banners.notifications.allowBody")}
          </p>
        </div>
      </div>
      {permission === "default" && (
        <button
          type="button"
          onClick={async () => setPermission(await Notification.requestPermission())}
          className="min-h-[44px] flex-shrink-0 rounded-xl bg-blue-500 px-4 text-sm font-medium text-white hover:bg-blue-600"
        >
          {t("banners.notifications.allowButton")}
        </button>
      )}
    </div>
  );
}

/**
 * Permanent entry point to /dashboard/plans — there's no other obvious way to find it once logged in,
 * so this stays visible whether or not a plan is already active (unlike the dismiss-once banners above).
 */
export function PlanBanner({ activePlanName }: { activePlanName: string | null }) {
  const t = useTranslations("dashboard");

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/40 bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Layers className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-500" />
        <div>
          <p className="text-sm font-semibold text-text">
            {activePlanName ? t("banners.plans.activeTitle", { plan: activePlanName }) : t("banners.plans.noneTitle")}
          </p>
          <p className="mt-0.5 text-xs italic text-text-muted">{t("banners.plans.body")}</p>
        </div>
      </div>
      <Link
        href="/dashboard/plans"
        className="flex min-h-[44px] flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-medium text-white hover:bg-emerald-600 sm:min-w-[9rem]"
      >
        {activePlanName ? t("banners.plans.changeButton") : t("banners.plans.chooseButton")}
      </Link>
    </div>
  );
}

export function TwoFactorBanner() {
  const t = useTranslations("dashboard");

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-surface p-4">
      <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
      <div>
        <p className="text-sm font-semibold text-text">{t("banners.twoFactor.title")}</p>
        <p className="mt-0.5 text-xs italic text-text-muted">
          {t.rich("banners.twoFactor.body", {
            link: (chunks) => (
              <Link href="/dashboard/2fa" className="text-blue-500 not-italic hover:underline">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    </div>
  );
}
