// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, LOCALES, NAMESPACES } from "@/i18n/config";
import { loadMessages } from "@tests/helpers/messages";

/**
 * Static analysis of translation usage. It finds `const t = useTranslations("ns")` /
 * `await getTranslations("ns")` bindings, attributes each `t("key")` / `t.rich("key")` call to the
 * binding that is in scope for it, and checks the resulting key exists in the English messages.
 * Anything it cannot attribute with confidence is skipped rather than reported.
 */

const SRC = path.join(process.cwd(), "src");

type Tree = { [key: string]: string | Tree };
const english = loadMessages(DEFAULT_LOCALE) as Tree;

// ---------------------------------------------------------------------------------------------
// Source scanning helpers
// ---------------------------------------------------------------------------------------------

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full === path.join(SRC, "messages") || full === path.join(SRC, "test") || entry.name === "node_modules") continue;
      out.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

interface Block {
  start: number;
  end: number;
}

/** Matching `{ }` ranges, skipping strings, comments and template literals. */
function blockRanges(src: string): Block[] {
  const blocks: Block[] = [];
  const stack: number[] = [];
  let i = 0;

  const skipTemplate = (from: number): number => {
    let j = from + 1;
    while (j < src.length && src[j] !== "`") {
      if (src[j] === "\\") j += 2;
      else if (src[j] === "$" && src[j + 1] === "{") j = skipExpression(j + 2);
      else j++;
    }
    return j + 1;
  };
  const skipExpression = (from: number): number => {
    let depth = 1;
    let j = from;
    while (j < src.length && depth > 0) {
      const c = src[j];
      if (c === "`") j = skipTemplate(j);
      else if (c === '"' || c === "'") j = skipQuoted(j);
      else {
        if (c === "{") depth++;
        else if (c === "}") depth--;
        j++;
      }
    }
    return j;
  };
  const skipQuoted = (from: number): number => {
    const quote = src[from];
    let j = from + 1;
    while (j < src.length && src[j] !== quote && src[j] !== "\n") {
      if (src[j] === "\\") j++;
      j++;
    }
    return j + 1; // an unterminated quote (JSX text such as "don't") ends at the line break
  };

  while (i < src.length) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
    } else if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      i = end === -1 ? src.length : end + 2;
    } else if (c === "`") i = skipTemplate(i);
    else if (c === '"' || c === "'") i = skipQuoted(i);
    else {
      if (c === "{") stack.push(i);
      else if (c === "}" && stack.length) blocks.push({ start: stack.pop()!, end: i });
      i++;
    }
  }
  for (const start of stack) blocks.push({ start, end: src.length });
  return blocks;
}

interface Binding {
  name: string;
  /** undefined: no namespace given (keys are absolute). null: namespace is not statically known. */
  namespace: string | null | undefined;
  pos: number;
  scopeStart: number;
  scopeEnd: number;
}

const BINDING_START = /(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(/g;
const STATIC_NS_ARG = /^\s*(?:(["'`])([^"'`$\\]*)\1|\{[^}]*?namespace\s*:\s*(["'`])([^"'`$\\]*)\3[^}]*\})?\s*\)/;

function findBindings(src: string): Binding[] {
  const blocks = blockRanges(src);
  const bindings: Binding[] = [];
  for (const match of src.matchAll(BINDING_START)) {
    const pos = match.index!;
    const args = STATIC_NS_ARG.exec(src.slice(pos + match[0].length, pos + match[0].length + 200));
    let namespace: string | null | undefined;
    if (!args) namespace = null;
    else namespace = args[2] ?? args[4] ?? undefined;

    const enclosing = blocks
      .filter((b) => b.start < pos && b.end > pos)
      .sort((a, b) => b.start - a.start)[0];
    bindings.push({
      name: match[1],
      namespace,
      pos,
      scopeStart: enclosing?.start ?? 0,
      scopeEnd: enclosing?.end ?? src.length,
    });
  }
  return bindings;
}

interface Usage {
  name: string;
  /** Static message key, or a static prefix when `dynamic` is set. */
  key: string;
  dynamic: boolean;
  pos: number;
  line: number;
}

function findUsages(src: string, names: string[]): Usage[] {
  const usages: Usage[] = [];
  for (const name of new Set(names)) {
    const re = new RegExp(`(?<![\\w$.])${name}(?:\\.(?:rich|raw|markup))?\\(\\s*(["'\`])`, "g");
    for (const match of src.matchAll(re)) {
      const quote = match[1];
      const start = match.index! + match[0].length;
      let end = start;
      while (end < src.length && src[end] !== quote) end += src[end] === "\\" ? 2 : 1;
      const literal = src.slice(start, end);
      const after = src.slice(end + 1).match(/^\s*(.)/)?.[1];
      const line = src.slice(0, match.index).split("\n").length;

      if (quote === "`" && literal.includes("${")) {
        usages.push({ name, key: literal.slice(0, literal.indexOf("${")), dynamic: true, pos: match.index!, line });
      } else if (after === "," || after === ")") {
        usages.push({ name, key: literal, dynamic: false, pos: match.index!, line });
      }
      // otherwise (concatenation, ternary, ...) the key is not static: skip
    }
  }
  return usages;
}

/** The innermost binding of `name` that is in scope at `pos`. */
function bindingFor(bindings: Binding[], name: string, pos: number): Binding | undefined {
  return bindings
    .filter((b) => b.name === name && b.pos < pos && b.scopeStart <= pos && b.scopeEnd >= pos)
    .sort((a, b) => b.scopeStart - a.scopeStart || b.pos - a.pos)[0];
}

// ---------------------------------------------------------------------------------------------
// Resolution against the English messages
// ---------------------------------------------------------------------------------------------

function lookup(fullKey: string): string | Tree | undefined {
  let node: string | Tree | undefined = english;
  for (const part of fullKey.split(".")) {
    if (typeof node !== "object" || node === null || !(part in node)) return undefined;
    node = node[part];
  }
  return node;
}

function fullKeyOf(namespace: string | undefined, key: string) {
  return namespace ? `${namespace}.${key}` : key;
}

function prefixExists(fullPrefix: string): boolean {
  if (fullPrefix.endsWith(".")) return typeof lookup(fullPrefix.slice(0, -1)) === "object";
  const dot = fullPrefix.lastIndexOf(".");
  const parent = dot === -1 ? english : lookup(fullPrefix.slice(0, dot));
  if (typeof parent !== "object") return false;
  return Object.keys(parent).some((k) => k.startsWith(fullPrefix.slice(dot + 1)));
}

interface Finding {
  file: string;
  line: number;
  message: string;
}

interface ScanResult {
  problems: Finding[];
  checkedStatic: number;
  checkedDynamic: number;
  skipped: number;
}

/** `(await getTranslations("ns"))("key")` - a translator created and called in one expression. */
const INLINE_CALL = /\(\s*(?:await\s+)?(?:getTranslations|useTranslations)\(\s*(["'])([^"'$\\]*)\1\s*\)\s*\)\(\s*(["'])([^"'$\\]*)\3\s*[,)]/g;

function scanSource(src: string, file: string): ScanResult {
  const result: ScanResult = { problems: [], checkedStatic: 0, checkedDynamic: 0, skipped: 0 };
  for (const match of src.matchAll(INLINE_CALL)) {
    const full = fullKeyOf(match[2], match[4]);
    if (typeof lookup(full) === "string") result.checkedStatic++;
    else {
      result.problems.push({ file, line: src.slice(0, match.index).split("\n").length, message: `missing English message "${full}" (inline translator)` });
    }
  }
  const bindings = findBindings(src);
  if (bindings.length === 0) return result;

  for (const usage of findUsages(src, bindings.map((b) => b.name))) {
    const binding = bindingFor(bindings, usage.name, usage.pos);
    if (!binding || binding.namespace === null) {
      result.skipped++;
      continue;
    }
    const sameName = bindings.filter((b) => b.name === usage.name);
    const candidates = usage.dynamic
      ? (ns: string | undefined) => prefixExists(fullKeyOf(ns, usage.key))
      : (ns: string | undefined) => typeof lookup(fullKeyOf(ns, usage.key)) === "string";

    if (candidates(binding.namespace)) {
      if (usage.dynamic) result.checkedDynamic++;
      else result.checkedStatic++;
      continue;
    }
    // If the key is valid under another binding of the same variable name, the scope attribution
    // is ambiguous (e.g. helpers, closures): skip instead of guessing.
    if (sameName.length > 1 && sameName.some((b) => b !== binding && b.namespace !== null && candidates(b.namespace))) {
      result.skipped++;
      continue;
    }

    const shown = fullKeyOf(binding.namespace, usage.key);
    result.problems.push({
      file,
      line: usage.line,
      message: usage.dynamic
        ? `dynamic key prefix "${shown}" does not match any English message group (${usage.name}, namespace "${binding.namespace ?? ""}")`
        : typeof lookup(shown) === "object"
          ? `key "${shown}" is a message group, not a message`
          : `missing English message "${shown}" (${usage.name}, namespace "${binding.namespace ?? ""}")`,
    });
  }
  return result;
}

// ---------------------------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------------------------

describe("key extraction heuristics", () => {
  it("finds bindings for useTranslations and getTranslations, awaited or not", () => {
    const src = `
      export function A() { const t = useTranslations("common"); return t("x"); }
      export async function B() { const tt = await getTranslations("landing.legal"); return tt("y"); }
    `;
    expect(findBindings(src).map((b) => [b.name, b.namespace])).toEqual([
      ["t", "common"],
      ["tt", "landing.legal"],
    ]);
  });

  it("supports the object form and the no-namespace form", () => {
    const src = `
      async function A() { const a = await getTranslations({ locale, namespace: "auth.login" }); }
      function B() { const b = useTranslations(); }
    `;
    expect(findBindings(src).map((b) => [b.name, b.namespace])).toEqual([
      ["a", "auth.login"],
      ["b", undefined],
    ]);
  });

  it("marks a non-static namespace as unknown", () => {
    const [binding] = findBindings(`function A({ ns }) { const t = useTranslations(ns); }`);
    expect(binding.namespace).toBeNull();
  });

  it("attributes the same variable name to different bindings per function", () => {
    const src = `
      function First() {
        const t = useTranslations("common");
        return t("close");
      }
      function Second() {
        const t = useTranslations("landing.hero");
        return t("badge");
      }
    `;
    const bindings = findBindings(src);
    const usages = findUsages(src, ["t"]);
    expect(usages.map((u) => bindingFor(bindings, u.name, u.pos)?.namespace)).toEqual(["common", "landing.hero"]);
  });

  it("handles several translators in one function", () => {
    const src = `
      function A() {
        const t = useTranslations("landing.hero");
        const tc = useTranslations("common");
        return [t("badge"), tc("close")];
      }
    `;
    const bindings = findBindings(src);
    const usages = findUsages(src, ["t", "tc"]);
    expect(usages.map((u) => [u.key, bindingFor(bindings, u.name, u.pos)?.namespace])).toEqual([
      ["badge", "landing.hero"],
      ["close", "common"],
    ]);
  });

  it("recognises t.rich and multi-line calls, and ignores method calls named t", () => {
    const src = `
      function A() {
        const t = useTranslations("landing.hero");
        obj.t("nope");
        return t.rich(
          "title",
          {},
        );
      }
    `;
    expect(findUsages(src, ["t"]).map((u) => u.key)).toEqual(["title"]);
  });

  it("flags template literals as dynamic with their static prefix", () => {
    const src = 'function A() { const t = useTranslations("landing.plans"); return t(`items.${id}.name`); }';
    expect(findUsages(src, ["t"])).toMatchObject([{ key: "items.", dynamic: true }]);
  });

  it("skips computed keys such as concatenations and identifiers", () => {
    const src = 'function A() { const t = useTranslations("x"); t("a" + b); t(key); t(cond ? "a" : "b"); }';
    expect(findUsages(src, ["t"])).toEqual([]);
  });

  it("does not let braces inside strings, templates or comments confuse scoping", () => {
    const src = `
      function A() {
        const s = "}}}";
        // } comment
        const u = \`\${x}}\`;
        const t = useTranslations("common");
        return t("close");
      }
      function B() {
        const t = useTranslations("landing.hero");
        return <p>Don't {t("badge")}</p>;
      }
    `;
    const bindings = findBindings(src);
    const usages = findUsages(src, ["t"]);
    expect(usages.map((u) => bindingFor(bindings, u.name, u.pos)?.namespace)).toEqual(["common", "landing.hero"]);
  });

  it("reports a missing key and accepts a present one", () => {
    const ok = scanSource('function A() { const t = useTranslations("common"); return t("close"); }', "ok.tsx");
    const bad = scanSource('function A() { const t = useTranslations("common"); return t("definitelyNotAKey"); }', "bad.tsx");
    expect(ok.problems).toEqual([]);
    expect(ok.checkedStatic).toBe(1);
    expect(bad.problems).toHaveLength(1);
    expect(bad.problems[0].message).toContain("common.definitelyNotAKey");
  });

  it("checks translators that are created and called inline", () => {
    const ok = scanSource('async function f() { return (await getTranslations("common"))("close"); }', "ok.ts");
    const bad = scanSource('async function f() { return (await getTranslations("common"))("nope.nope"); }', "bad.ts");
    expect(ok).toMatchObject({ checkedStatic: 1, problems: [] });
    expect(bad.problems).toHaveLength(1);
  });

  it("reports a dynamic prefix that does not exist", () => {
    const bad = scanSource('function A() { const t = useTranslations("common"); return t(`nothingHere.${x}`); }', "bad.tsx");
    expect(bad.problems).toHaveLength(1);
    const ok = scanSource('function A() { const t = useTranslations("landing.plans"); return t(`items.${x}.name`); }', "ok.tsx");
    expect(ok.problems).toEqual([]);
    expect(ok.checkedDynamic).toBe(1);
  });

  it("treats a key that resolves to a message group as a problem", () => {
    const bad = scanSource('function A() { const t = useTranslations("landing"); return t("hero"); }', "bad.tsx");
    expect(bad.problems[0]?.message).toContain("message group");
  });

  it("skips usages whose binding has an unknown namespace", () => {
    const r = scanSource("function A({ns}) { const t = useTranslations(ns); return t('whatever'); }", "x.tsx");
    expect(r.problems).toEqual([]);
    expect(r.skipped).toBe(1);
  });

  it("skips a key that is only valid under another same-named binding (ambiguous scope)", () => {
    const src = `
      function A() { const t = useTranslations("common"); return t("close"); }
      function helper() { return t("close"); }
      function B() { const t = useTranslations("landing.hero"); return t("badge"); }
    `;
    expect(scanSource(src, "amb.tsx").problems).toEqual([]);
  });
});

describe("translation keys used in source", () => {
  const files = listSourceFiles(SRC);
  const scans = files.map((file) => ({ file: path.relative(process.cwd(), file), ...scanSource(readFileSync(file, "utf8"), path.relative(process.cwd(), file)) }));

  it("scans a meaningful number of source files", () => {
    expect(files.length).toBeGreaterThan(30);
    expect(files.some((f) => f.endsWith(path.join("marketing", "Hero.tsx")))).toBe(true);
    expect(files.some((f) => f.startsWith(path.join(SRC, "messages") + path.sep))).toBe(false);
    expect(files.some((f) => /\.test\.tsx?$/.test(f))).toBe(false);
  });

  it("finds a meaningful number of static keys (the scan is not vacuous)", () => {
    const total = scans.reduce((n, s) => n + s.checkedStatic, 0);
    expect(total).toBeGreaterThan(100);
  });

  it("finds dynamic key prefixes too", () => {
    expect(scans.reduce((n, s) => n + s.checkedDynamic, 0)).toBeGreaterThan(3);
  });

  it("every statically-resolvable key exists in the English messages", () => {
    const problems = scans.flatMap((s) => s.problems.map((p) => `${p.file}:${p.line} ${p.message}`));
    expect(problems, `unresolved translation keys:\n${problems.join("\n")}`).toEqual([]);
  });

  it("every namespace used by a binding starts at a real message file", () => {
    const unknown: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const b of findBindings(src)) {
        if (b.namespace === undefined || b.namespace === null) continue;
        if (typeof lookup(b.namespace) !== "object") {
          unknown.push(`${path.relative(process.cwd(), file)}: namespace "${b.namespace}" does not exist`);
        }
      }
    }
    expect(unknown).toEqual([]);
  });

  it("every top-level message namespace is one of the configured NAMESPACES", () => {
    expect(Object.keys(english).sort()).toEqual([...NAMESPACES].sort());
  });

  it("every static key used in source also exists in every other locale", () => {
    // Fallback to English hides gaps at runtime, so make sure translations cover everything the UI asks for.
    const missing: string[] = [];
    const localeMessages = LOCALES.filter((l) => l.code !== DEFAULT_LOCALE).map((l) => ({
      code: l.code,
      messages: loadMessages(l.code) as Tree,
    }));
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      const bindings = findBindings(src);
      for (const usage of findUsages(src, bindings.map((b) => b.name))) {
        const binding = bindingFor(bindings, usage.name, usage.pos);
        if (!binding || binding.namespace === null || usage.dynamic) continue;
        const full = fullKeyOf(binding.namespace, usage.key);
        if (typeof lookup(full) !== "string") continue; // reported by the English test
        for (const { code, messages } of localeMessages) {
          let node: string | Tree | undefined = messages;
          for (const part of full.split(".")) node = typeof node === "object" ? node[part] : undefined;
          if (typeof node !== "string") missing.push(`${code}: ${full} (${path.relative(process.cwd(), file)}:${usage.line})`);
        }
      }
    }
    expect(missing, `keys used in source but missing from translations:\n${missing.join("\n")}`).toEqual([]);
  });
});
