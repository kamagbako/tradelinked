"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { logError } from "@/lib/logger";

interface ErrorViewProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** Where "go back" points: the public site, or the section the error happened in. */
  scope: "app" | "dashboard" | "admin";
}

const HOME: Record<ErrorViewProps["scope"], { href: string; labelKey: "goHome" | "goToDashboard" | "goToAdmin" }> = {
  app: { href: "/", labelKey: "goHome" },
  dashboard: { href: "/dashboard", labelKey: "goToDashboard" },
  admin: { href: "/admin", labelKey: "goToAdmin" },
};

/** Shared UI for route-level error boundaries (error.tsx). */
export function ErrorView({ error, reset, scope }: ErrorViewProps) {
  const t = useTranslations("common.errorBoundary");
  const home = HOME[scope];
  // Configuration errors (missing/invalid env vars) are actionable and never contain secret values.
  const configProblem = error.name === "MissingEnvError" || error.name === "InvalidEnvError" ? error.message : null;

  useEffect(() => {
    logError(`route:${scope}`, error, { digest: error.digest });
  }, [error, scope]);

  return (
    <div role="alert" className="glass-card mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl p-10 text-center">
      <AlertTriangle className="h-8 w-8 text-amber-400" />
      <div>
        <p className="font-medium text-text">{t("title")}</p>
        <p className="mt-1 text-sm text-text-muted">{t("description")}</p>
        {configProblem && (
          <p className="mt-3 rounded-lg bg-hover p-3 text-left font-mono text-xs text-text-muted">{configProblem}</p>
        )}
        {error.digest && <p className="mt-2 text-xs text-text-muted">{t("reference", { digest: error.digest })}</p>}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={reset}>{t("tryAgain")}</Button>
        <Link href={home.href}>
          <Button variant="secondary">{t(home.labelKey)}</Button>
        </Link>
      </div>
    </div>
  );
}
