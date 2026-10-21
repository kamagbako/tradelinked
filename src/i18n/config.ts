// To add a language: add it here, then add a folder src/messages/<code>/ with a copy of every file in src/messages/en/.
export const LOCALES = [
  { code: "en", name: "English", short: "EN" },
  { code: "fr", name: "Français", short: "FR" },
  { code: "es", name: "Español", short: "ES" },
  { code: "pt", name: "Português", short: "PT" },
  { code: "de", name: "Deutsch", short: "DE" },
  { code: "zh", name: "中文", short: "中文" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** One JSON file per namespace lives in src/messages/<locale>/<namespace>.json */
export const NAMESPACES = ["common", "landing", "auth", "dashboard"] as const;

export function isLocale(value: string | undefined | null): value is Locale {
  return LOCALES.some((l) => l.code === value);
}
