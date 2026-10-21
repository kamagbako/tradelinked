import { getTranslations } from "next-intl/server";
import { logError } from "@/lib/logger";

/** Digests Next.js uses to implement redirect()/notFound() by throwing — these must never be swallowed. */
const FRAMEWORK_DIGESTS = [
  "NEXT_REDIRECT",
  "NEXT_NOT_FOUND",
  "NEXT_HTTP_ERROR_FALLBACK",
  "DYNAMIC_SERVER_USAGE",
  "BAILOUT_TO_CLIENT_SIDE_RENDERING",
];

export function isFrameworkSignal(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const digest = (error as { digest?: unknown }).digest;
  const message = (error as { message?: unknown }).message;
  return (
    (typeof digest === "string" && FRAMEWORK_DIGESTS.some((d) => digest.startsWith(d))) ||
    (typeof message === "string" && FRAMEWORK_DIGESTS.includes(message))
  );
}

/**
 * Wraps a server action so an unexpected throw (network failure, bug, outage) becomes a friendly,
 * translated `{ error }` result instead of a crashed page. redirect()/notFound() still propagate.
 */
export async function runAction<T extends { error?: string }>(
  context: string,
  fn: () => Promise<T>,
): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (error) {
    if (isFrameworkSignal(error)) throw error;
    logError(`action:${context}`, error);

    let message = "Something went wrong. Please try again.";
    try {
      message = (await getTranslations("common"))("errors.unexpected");
    } catch {
      // Translation lookup itself failed — the English fallback above is used.
    }
    return { error: message };
  }
}
