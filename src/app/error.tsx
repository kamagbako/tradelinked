"use client";

import { ErrorView } from "@/components/error/ErrorView";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <ErrorView error={error} reset={reset} scope="app" />
    </div>
  );
}
