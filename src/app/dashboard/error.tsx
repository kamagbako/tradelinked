"use client";

import { ErrorView } from "@/components/error/ErrorView";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorView error={error} reset={reset} scope="dashboard" />;
}
