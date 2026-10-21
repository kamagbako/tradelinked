import { Resend } from "resend";

export const EMAIL_FROM = process.env.RESEND_FROM_EMAIL ?? "TradeLinked <notifications@tradelinked.app>";
export const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL ?? "";

let client: Resend | null = null;

/**
 * Lazily creates the Resend client. `new Resend()` throws when no API key is set, so constructing it at
 * import time would crash every page that (transitively) imports the withdrawal actions in dev.
 * Returns null when email isn't configured.
 */
export function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  client ??= new Resend(apiKey);
  return client;
}
