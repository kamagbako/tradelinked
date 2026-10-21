import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, NAMESPACES, isLocale, type Locale } from "@/i18n/config";

type Messages = { [key: string]: string | Messages };

async function loadMessages(locale: Locale): Promise<Messages> {
  const entries = await Promise.all(
    NAMESPACES.map(async (ns) => {
      try {
        return [ns, (await import(`../messages/${locale}/${ns}.json`)).default] as const;
      } catch {
        return [ns, {}] as const; // A namespace not yet translated falls back to English below.
      }
    }),
  );
  return Object.fromEntries(entries);
}

function merge(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = out[key];
    out[key] =
      typeof value === "object" && value !== null && typeof existing === "object"
        ? merge(existing as Messages, value)
        : value;
  }
  return out;
}

/** Saved choice wins; otherwise best match from the browser's Accept-Language; otherwise English. */
async function detectLocale(): Promise<Locale> {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;

  const accepted = (await headers()).get("accept-language") ?? "";
  for (const part of accepted.split(",")) {
    const tag = part.split(";")[0].trim().toLowerCase().split("-")[0];
    if (isLocale(tag)) return tag;
  }
  return DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await detectLocale();
  const english = await loadMessages(DEFAULT_LOCALE);
  // Any key missing from a translation shows the English text instead of an error.
  const messages = locale === DEFAULT_LOCALE ? english : merge(english, await loadMessages(locale));

  return { locale, messages };
});
