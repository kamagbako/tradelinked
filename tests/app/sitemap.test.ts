import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function load(siteUrl?: string) {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", siteUrl);
  vi.resetModules();
  return (await import("@/app/sitemap")).default();
}

describe("sitemap.ts", () => {
  it("lists home, login and register", async () => {
    const urls = (await load("https://tradelinked.example")).map((e) => e.url);
    expect(urls).toEqual([
      "https://tradelinked.example",
      "https://tradelinked.example/login",
      "https://tradelinked.example/register",
    ]);
  });

  it("uses localhost when no site URL is configured", async () => {
    const urls = (await load()).map((e) => e.url);
    expect(urls[0]).toBe("http://localhost:3000");
  });

  it("gives the home page the highest priority", async () => {
    const entries = await load();
    const [home, ...rest] = entries;
    expect(home.priority).toBe(1);
    for (const entry of rest) expect(entry.priority).toBeLessThan(1);
  });

  it("never lists private routes", async () => {
    const urls = (await load()).map((e) => e.url);
    expect(urls.some((u) => /dashboard|admin|api/.test(u))).toBe(false);
  });

  it("sets a lastModified date on every entry", async () => {
    for (const entry of await load()) expect(entry.lastModified).toBeInstanceOf(Date);
  });
});
