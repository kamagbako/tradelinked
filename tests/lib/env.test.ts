import { afterEach, describe, expect, it, vi } from "vitest";
import { InvalidEnvError, MissingEnvError, getServiceRoleKey, getSiteUrl, getSupabaseEnv } from "@/lib/env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("MissingEnvError", () => {
  it("uses singular wording for one variable", () => {
    const err = new MissingEnvError(["FOO"]);
    expect(err.message).toContain("Missing environment variable: FOO.");
    expect(err.name).toBe("MissingEnvError");
    expect(err).toBeInstanceOf(Error);
  });

  it("uses plural wording and lists all names", () => {
    const err = new MissingEnvError(["A", "B"]);
    expect(err.message).toContain("Missing environment variables: A, B.");
  });

  it("points at .env.example", () => {
    expect(new MissingEnvError(["A"]).message).toContain(".env.example");
  });
});

describe("getSupabaseEnv", () => {
  it("returns url and anon key when both are set", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    expect(getSupabaseEnv()).toEqual({ url: "https://x.supabase.co", anonKey: "anon" });
  });

  it("names both variables when neither is set", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(() => getSupabaseEnv()).toThrowError(MissingEnvError);
    expect(() => getSupabaseEnv()).toThrowError(
      /Missing environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY\./,
    );
  });

  it("names only the URL when only the anon key is set", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    expect(() => getSupabaseEnv()).toThrowError(/variable: NEXT_PUBLIC_SUPABASE_URL\./);
    expect(() => getSupabaseEnv()).not.toThrowError(/ANON_KEY/);
  });

  it("names only the anon key when only the URL is set", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(() => getSupabaseEnv()).toThrowError(/variable: NEXT_PUBLIC_SUPABASE_ANON_KEY\./);
    expect(() => getSupabaseEnv()).not.toThrowError(/SUPABASE_URL/);
  });
});

describe("getServiceRoleKey", () => {
  it("returns the key when set", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    expect(getServiceRoleKey()).toBe("service-key");
  });

  it("throws MissingEnvError naming the variable when unset", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(() => getServiceRoleKey()).toThrowError(MissingEnvError);
    expect(() => getServiceRoleKey()).toThrowError(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});

describe("getSupabaseEnv value hygiene", () => {
  it("trims stray whitespace and newlines pasted into a hosting dashboard", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "  https://x.supabase.co\n");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", " anon-key \n");
    expect(getSupabaseEnv()).toEqual({ url: "https://x.supabase.co", anonKey: "anon-key" });
  });

  it("treats a whitespace-only value as missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "   ");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    expect(() => getSupabaseEnv()).toThrowError(MissingEnvError);
  });

  it("rejects a URL without a scheme with a helpful message", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    expect(() => getSupabaseEnv()).toThrowError(InvalidEnvError);
    expect(() => getSupabaseEnv()).toThrowError(/NEXT_PUBLIC_SUPABASE_URL.*include https:\/\//);
  });

  it("rejects non-http(s) schemes", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "ftp://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    expect(() => getSupabaseEnv()).toThrowError(/must start with https/);
  });

  it("allows http for local development", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    expect(getSupabaseEnv().url).toBe("http://127.0.0.1:54321");
  });

  it("never echoes the offending value in the error", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "super-secret-looking-value");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    expect(() => getSupabaseEnv()).not.toThrowError(/super-secret-looking-value/);
  });

  it("trims the service role key", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "  key\n");
    expect(getServiceRoleKey()).toBe("key");
  });
});

describe("InvalidEnvError", () => {
  it("is named, is an Error and names the variable", () => {
    const err = new InvalidEnvError("FOO", "must be bar.");
    expect(err.name).toBe("InvalidEnvError");
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("Invalid environment variable FOO: must be bar.");
  });
});

describe("getSiteUrl", () => {
  const clear = () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("VERCEL_URL", "");
  };

  it("uses NEXT_PUBLIC_SITE_URL when valid", () => {
    clear();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://tradelinked.example");
    expect(getSiteUrl()).toBe("https://tradelinked.example");
  });

  it("reduces a URL with a path or trailing slash to its origin", () => {
    clear();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://tradelinked.example/some/path/");
    expect(getSiteUrl()).toBe("https://tradelinked.example");
  });

  it("adds https:// to a scheme-less value instead of throwing", () => {
    clear();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "tradelinked.example");
    expect(getSiteUrl()).toBe("https://tradelinked.example");
  });

  it("trims whitespace", () => {
    clear();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "  https://tradelinked.example \n");
    expect(getSiteUrl()).toBe("https://tradelinked.example");
  });

  it("falls back to the Vercel production domain, then the deployment URL", () => {
    clear();
    vi.stubEnv("VERCEL_URL", "app-git-branch.vercel.app");
    expect(getSiteUrl()).toBe("https://app-git-branch.vercel.app");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "tradelinked.vercel.app");
    expect(getSiteUrl()).toBe("https://tradelinked.vercel.app");
  });

  it("prefers the explicit site URL over Vercel's", () => {
    clear();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://custom.example");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "tradelinked.vercel.app");
    expect(getSiteUrl()).toBe("https://custom.example");
  });

  it("falls back to localhost when nothing is configured", () => {
    clear();
    expect(getSiteUrl()).toBe("http://localhost:3000");
  });

  it("never throws, even for garbage input", () => {
    clear();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://");
    expect(() => getSiteUrl()).not.toThrow();
    expect(getSiteUrl()).toBe("http://localhost:3000");
  });
});
