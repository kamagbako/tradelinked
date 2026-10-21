type Context = Record<string, unknown>;

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unknown error");
}

/**
 * Single choke point for reporting unexpected errors. Today it writes to the console;
 * plug an error-tracking service (Sentry, etc.) in here and every boundary/action reports to it.
 */
export function logError(scope: string, error: unknown, context: Context = {}) {
  const err = toError(error);
  console.error(`[tradelinked] ${scope}: ${err.message}`, { ...context, stack: err.stack });
}

export function logWarn(scope: string, message: string, context: Context = {}) {
  console.warn(`[tradelinked] ${scope}: ${message}`, context);
}
