import { readFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_LOCALE, NAMESPACES, type Locale } from "@/i18n/config";

type Messages = { [key: string]: string | Messages };

/** Loads the real message files for a locale, exactly as the app does (namespace file => top-level key). */
export function loadMessages(locale: Locale | string = DEFAULT_LOCALE): Messages {
  const dir = path.join(process.cwd(), "src", "messages", locale);
  return Object.fromEntries(
    NAMESPACES.map((ns) => [ns, JSON.parse(readFileSync(path.join(dir, `${ns}.json`), "utf8")) as Messages]),
  );
}

/** Flattens nested messages to dotted keys: { a: { b: "x" } } -> { "a.b": "x" } */
export function flatten(messages: Messages, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(messages)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out[full] = value;
    else Object.assign(out, flatten(value, full));
  }
  return out;
}
