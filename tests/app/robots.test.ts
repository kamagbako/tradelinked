import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function load(siteUrl?: string) {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", siteUrl);
  vi.resetModules();
  return (await import("@/app/robots")).default();
}

describe("robots.ts", () => {
  it("allows the public site but blocks private areas", async () => {
    const result = await load();
    expect(result.rules).toEqual([{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/admin", "/api"] }]);
  });

  it("points at the sitemap under the configured site URL", async () => {
    expect((await load("https://tradelinked.example")).sitemap).toBe("https://tradelinked.example/sitemap.xml");
  });

  it("uses the Vercel domain when no site URL is configured", async () => {
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "tradelinked.vercel.app");
    expect((await load()).sitemap).toBe("https://tradelinked.vercel.app/sitemap.xml");
  });

  it("does not throw for an empty or scheme-less site URL", async () => {
    expect((await load("")).sitemap).toMatch(/\/sitemap\.xml$/);
    expect((await load("tradelinked.example")).sitemap).toBe("https://tradelinked.example/sitemap.xml");
  });

  it("falls back to localhost when no site URL is configured", async () => {
    expect((await load()).sitemap).toBe("http://localhost:3000/sitemap.xml");
  });
});
