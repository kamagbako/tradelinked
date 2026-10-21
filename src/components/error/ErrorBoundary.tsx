"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { logError } from "@/lib/logger";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Name used in logs so you can tell which boundary caught what. */
  name?: string;
  /** Static node, or a render function receiving the error and a reset callback. `null` renders nothing. */
  fallback?: ReactNode | ((args: { error: Error; reset: () => void }) => ReactNode);
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Catches render errors in its subtree so one broken component can't take down the whole page. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logError(`boundary:${this.props.name ?? "unnamed"}`, error, { componentStack: info.componentStack });
    this.props.onError?.(error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const { fallback } = this.props;
    if (typeof fallback === "function") return fallback({ error, reset: this.reset });
    return fallback === undefined ? null : fallback;
  }
}

function WidgetFallback({ reset }: { reset: () => void }) {
  const t = useTranslations("common.errorBoundary");

  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 text-sm">
      <span className="flex items-center gap-2 text-text-muted">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-400" />
        {t("widgetFailed")}
      </span>
      <button type="button" onClick={reset} className="min-h-[44px] rounded-xl px-3 font-medium text-blue-500 hover:bg-hover">
        {t("tryAgain")}
      </button>
    </div>
  );
}

/**
 * Isolates a self-contained widget (charts, ticker, chat). On failure it shows a small retry card,
 * or nothing at all when `silent` (for optional extras like the chat bubble).
 */
export function WidgetBoundary({ children, name, silent = false }: { children: ReactNode; name: string; silent?: boolean }) {
  return (
    <ErrorBoundary name={name} fallback={silent ? null : ({ reset }) => <WidgetFallback reset={reset} />}>
      {children}
    </ErrorBoundary>
  );
}
