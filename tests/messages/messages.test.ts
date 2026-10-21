// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, LOCALES, NAMESPACES } from "@/i18n/config";

const MESSAGES_DIR = path.join(process.cwd(), "src", "messages");
const OTHER_LOCALES = LOCALES.map((l) => l.code).filter((code) => code !== DEFAULT_LOCALE);

type Tree = { [key: string]: string | Tree };

function readNamespace(locale: string, ns: string): Tree {
  return JSON.parse(readFileSync(path.join(MESSAGES_DIR, locale, `${ns}.json`), "utf8")) as Tree;
}

/** Flattens to dotted keys. Non-string leaves are reported separately rather than dropped. */
function flattenTree(tree: Tree, prefix = ""): { strings: Record<string, string>; nonStrings: string[] } {
  const strings: Record<string, string> = {};
  const nonStrings: string[] = [];
  for (const [key, value] of Object.entries(tree)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") strings[full] = value;
    else if (value && typeof value === "object" && !Array.isArray(value)) {
      const inner = flattenTree(value, full);
      Object.assign(strings, inner.strings);
      nonStrings.push(...inner.nonStrings);
    } else nonStrings.push(full);
  }
  return { strings, nonStrings };
}

// ICU AST node types (from @formatjs/icu-messageformat-parser).
const TYPE = { literal: 0, argument: 1, number: 2, date: 3, time: 4, select: 5, plural: 6, pound: 7, tag: 8 } as const;

interface AstNode {
  type: number;
  value?: string;
  children?: AstNode[];
  options?: Record<string, { value: AstNode[] }>;
}

interface Signature {
  args: string[];
  tags: string[];
  /** Names of arguments used as plural selectors, with the plural branches used. */
  plurals: { name: string; branches: string[] }[];
}

function parseAst(message: string, locale: string): AstNode[] {
  return new IntlMessageFormat(message, locale).getAst() as unknown as AstNode[];
}

function signatureOf(message: string, locale: string): Signature {
  const args = new Set<string>();
  const tags = new Set<string>();
  const plurals: Signature["plurals"] = [];

  const walk = (nodes: AstNode[]) => {
    for (const node of nodes) {
      switch (node.type) {
        case TYPE.argument:
        case TYPE.number:
        case TYPE.date:
        case TYPE.time:
          args.add(node.value!);
          break;
        case TYPE.select:
        case TYPE.plural:
          args.add(node.value!);
          if (node.type === TYPE.plural) plurals.push({ name: node.value!, branches: Object.keys(node.options ?? {}) });
          for (const option of Object.values(node.options ?? {})) walk(option.value);
          break;
        case TYPE.tag:
          tags.add(node.value!);
          walk(node.children ?? []);
          break;
      }
    }
  };
  walk(parseAst(message, locale));
  return { args: [...args].sort(), tags: [...tags].sort(), plurals: plurals.sort((a, b) => a.name.localeCompare(b.name)) };
}

const englishByNamespace = Object.fromEntries(
  NAMESPACES.map((ns) => [ns, flattenTree(readNamespace(DEFAULT_LOCALE, ns))]),
);

describe("locale configuration", () => {
  it("has English as the default locale and it is listed", () => {
    expect(LOCALES.map((l) => l.code)).toContain(DEFAULT_LOCALE);
  });

  it("has unique locale codes", () => {
    const codes = LOCALES.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("has at least one non-English locale to compare against", () => {
    expect(OTHER_LOCALES.length).toBeGreaterThan(0);
  });

  it("lists the expected namespaces", () => {
    expect([...NAMESPACES].sort()).toEqual(["auth", "common", "dashboard", "landing"]);
  });

  it.each(LOCALES.map((l) => l.code))("has a src/messages/%s folder", (code) => {
    expect(existsSync(path.join(MESSAGES_DIR, code)), `missing folder src/messages/${code}`).toBe(true);
  });

  it.each(LOCALES.map((l) => l.code))("%s has every namespace json file", (code) => {
    const missing = NAMESPACES.filter((ns) => !existsSync(path.join(MESSAGES_DIR, code, `${ns}.json`)));
    expect(missing, `src/messages/${code} is missing: ${missing.map((m) => `${m}.json`).join(", ")}`).toEqual([]);
  });

  it("has a message folder for no locale that is not configured", () => {
    const folders = readdirSync(MESSAGES_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    const configured = LOCALES.map((l) => l.code) as string[];
    const stray = folders.filter((f) => !configured.includes(f));
    expect(stray, `folders in src/messages that are not in LOCALES: ${stray.join(", ")}`).toEqual([]);
  });
});

describe("English source messages", () => {
  it.each(NAMESPACES)("%s has only string leaves", (ns) => {
    expect(englishByNamespace[ns].nonStrings).toEqual([]);
  });

  it.each(NAMESPACES)("%s has no empty strings", (ns) => {
    const empty = Object.entries(englishByNamespace[ns].strings)
      .filter(([, v]) => v.trim() === "")
      .map(([k]) => k);
    expect(empty).toEqual([]);
  });

  it.each(NAMESPACES)("%s is non-trivial", (ns) => {
    expect(Object.keys(englishByNamespace[ns].strings).length).toBeGreaterThan(3);
  });
});

describe.each(OTHER_LOCALES)("translations: %s", (locale) => {
  describe.each(NAMESPACES)("%s.json", (ns) => {
    const english = englishByNamespace[ns];
    const translated = flattenTree(readNamespace(locale, ns));

    it("has the same set of keys as English", () => {
      const enKeys = Object.keys(english.strings);
      const localeKeys = Object.keys(translated.strings);
      const missing = enKeys.filter((k) => !(k in translated.strings));
      const extra = localeKeys.filter((k) => !(k in english.strings));
      expect(
        { missing, extra },
        `${locale}/${ns}.json vs en: missing ${missing.length} key(s) [${missing.slice(0, 10).join(", ")}], ` +
          `extra ${extra.length} key(s) [${extra.slice(0, 10).join(", ")}]`,
      ).toEqual({ missing: [], extra: [] });
    });

    it("has only string values", () => {
      expect(translated.nonStrings, `non-string values in ${locale}/${ns}.json`).toEqual([]);
    });

    it("has no empty or whitespace-only strings", () => {
      const empty = Object.entries(translated.strings)
        .filter(([, v]) => v.trim() === "")
        .map(([k]) => k);
      expect(empty, `empty strings in ${locale}/${ns}.json`).toEqual([]);
    });

    it("has messages that are all valid ICU", () => {
      const errors: string[] = [];
      for (const [key, message] of Object.entries(translated.strings)) {
        try {
          parseAst(message, locale);
        } catch (error) {
          errors.push(`${key}: ${(error as Error).message} in ${JSON.stringify(message)}`);
        }
      }
      expect(errors, `invalid ICU messages in ${locale}/${ns}.json`).toEqual([]);
    });

    it("uses the same placeholders as English for every key", () => {
      const mismatches: string[] = [];
      for (const [key, enMessage] of Object.entries(english.strings)) {
        const localised = translated.strings[key];
        if (localised === undefined) continue; // reported by the key-set test
        try {
          const expected = signatureOf(enMessage, DEFAULT_LOCALE).args;
          const actual = signatureOf(localised, locale).args;
          if (JSON.stringify(expected) !== JSON.stringify(actual)) {
            mismatches.push(`${key}: expected {${expected.join(", ")}} but found {${actual.join(", ")}}`);
          }
        } catch {
          // reported by the ICU-validity test
        }
      }
      expect(mismatches, `placeholder mismatches in ${locale}/${ns}.json`).toEqual([]);
    });

    it("uses the same rich-text tags as English for every key", () => {
      const mismatches: string[] = [];
      for (const [key, enMessage] of Object.entries(english.strings)) {
        const localised = translated.strings[key];
        if (localised === undefined) continue;
        try {
          const expected = signatureOf(enMessage, DEFAULT_LOCALE).tags;
          const actual = signatureOf(localised, locale).tags;
          if (JSON.stringify(expected) !== JSON.stringify(actual)) {
            mismatches.push(`${key}: expected <${expected.join(">, <")}> but found <${actual.join(">, <")}>`);
          }
        } catch {
          // reported by the ICU-validity test
        }
      }
      expect(mismatches, `rich-text tag mismatches in ${locale}/${ns}.json`).toEqual([]);
    });

    it("keeps plural messages on the same argument as English", () => {
      const mismatches: string[] = [];
      for (const [key, enMessage] of Object.entries(english.strings)) {
        const localised = translated.strings[key];
        if (localised === undefined) continue;
        try {
          const expected = signatureOf(enMessage, DEFAULT_LOCALE).plurals.map((p) => p.name);
          const actual = signatureOf(localised, locale).plurals.map((p) => p.name);
          if (JSON.stringify(expected) !== JSON.stringify(actual)) {
            mismatches.push(`${key}: English pluralises on [${expected.join(", ")}] but ${locale} on [${actual.join(", ")}]`);
          }
        } catch {
          // reported by the ICU-validity test
        }
      }
      expect(mismatches, `plural mismatches in ${locale}/${ns}.json`).toEqual([]);
    });

    it("only uses plural branches valid for the locale", () => {
      const categories = new Set(new Intl.PluralRules(locale).resolvedOptions().pluralCategories as string[]);
      const problems: string[] = [];
      for (const [key, message] of Object.entries(translated.strings)) {
        try {
          for (const plural of signatureOf(message, locale).plurals) {
            for (const branch of plural.branches) {
              if (!branch.startsWith("=") && !categories.has(branch) && branch !== "other") {
                problems.push(`${key}: branch "${branch}" is not a plural category of ${locale}`);
              }
            }
            expect(plural.branches, `${key} needs an "other" branch`).toContain("other");
          }
        } catch (error) {
          if (error instanceof Error && error.name === "AssertionError") throw error;
        }
      }
      expect(problems).toEqual([]);
    });

    it("does not leave stray unbalanced braces or angle-bracket junk in plain messages", () => {
      const suspicious: string[] = [];
      for (const [key, message] of Object.entries(translated.strings)) {
        const opens = (message.match(/\{/g) ?? []).length;
        const closes = (message.match(/\}/g) ?? []).length;
        if (opens !== closes) suspicious.push(`${key}: unbalanced braces`);
      }
      expect(suspicious).toEqual([]);
    });
  });
});

describe("plural messages", () => {
  const pluralKeys = Object.entries(englishByNamespace).flatMap(([ns, { strings }]) =>
    Object.entries(strings)
      .filter(([, message]) => signatureOf(message, DEFAULT_LOCALE).plurals.length > 0)
      .map(([key]) => `${ns}:${key}`),
  );

  it("exist in English (so the plural checks above are meaningful)", () => {
    expect(pluralKeys.length).toBeGreaterThanOrEqual(2);
  });

  it.each(pluralKeys)("%s pluralises on {total} and formats in every locale", (id) => {
    const [ns, key] = id.split(":");
    for (const { code } of LOCALES) {
      const message = flattenTree(readNamespace(code, ns)).strings[key];
      const formatter = new IntlMessageFormat(message, code);
      const values = { total: 3, approved: 1, pending: 1, rejected: 1, completed: 1 };
      const one = formatter.format({ ...values, total: 1 }) as string;
      const many = formatter.format(values) as string;
      expect(one, code).toContain("1");
      expect(many, code).toContain("3");
      expect(many, code).not.toMatch(/[{}#]/);
    }
  });
});
