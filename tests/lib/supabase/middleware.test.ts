import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type SupabaseMockOptions } from "@tests/helpers/supabase";

const { createServerClientMock, nextMock, redirectMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
  nextMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({ createServerClient: createServerClientMock }));
vi.mock("next/server", () => ({
  NextResponse: { next: nextMock, redirect: redirectMock },
}));

import { updateSession } from "@/lib/supabase/middleware";

type Cookie = { name: string; value: string };

function makeRequest(pathname: string, cookies: Cookie[] = []) {
  return {
    url: `https://app.example.com${pathname}`,
    nextUrl: { pathname },
    cookies: { getAll: vi.fn(() => cookies), set: vi.fn() },
  };
}

function setup(options: SupabaseMockOptions = {}) {
  const mock = createSupabaseMock(options);
  createServerClientMock.mockReturnValue(mock.client);
  return mock;
}

function run(pathname: string) {
  const request = makeRequest(pathname);
  return { request, result: updateSession(request as never) };
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://proj.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  nextMock.mockImplementation(() => ({ kind: "next", cookies: { set: vi.fn() } }));
  redirectMock.mockImplementation((url: URL) => ({ kind: "redirect", url: url.toString() }));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("updateSession redirects", () => {
  it.each(["/dashboard", "/dashboard/deposit", "/admin", "/admin/users"])(
    "sends an unauthenticated user on %s to /login with redirectTo",
    async (path) => {
      setup({ user: null });
      const { result } = run(path);
      await expect(result).resolves.toEqual({
        kind: "redirect",
        url: `https://app.example.com/login?redirectTo=${encodeURIComponent(path)}`,
      });
    },
  );

  it.each(["/login", "/register"])("sends a signed-in user on %s to /dashboard", async (path) => {
    setup({ user: { id: "u1" }, tables: { profiles: { data: { role: "USER" } } } });
    const { result } = run(path);
    await expect(result).resolves.toEqual({ kind: "redirect", url: "https://app.example.com/dashboard" });
  });

  it.each(["/login", "/register"])("sends a signed-in admin on %s straight to /admin instead", async (path) => {
    setup({ user: { id: "admin-1" }, tables: { profiles: { data: { role: "ADMIN" } } } });
    const { result } = run(path);
    await expect(result).resolves.toEqual({ kind: "redirect", url: "https://app.example.com/admin" });
  });

  it("lets an unauthenticated user reach /login and /register", async () => {
    setup({ user: null });
    for (const path of ["/login", "/register"]) {
      const { result } = run(path);
      await expect(result).resolves.toMatchObject({ kind: "next" });
    }
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("lets an unauthenticated user reach public paths", async () => {
    setup({ user: null });
    for (const path of ["/", "/pricing", "/about"]) {
      const { result } = run(path);
      await expect(result).resolves.toMatchObject({ kind: "next" });
    }
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("lets a signed-in user reach a public path without a profile lookup", async () => {
    const { client } = setup({ user: { id: "u1" } });
    const { result } = run("/");
    await expect(result).resolves.toMatchObject({ kind: "next" });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("lets a signed-in user reach /dashboard without a profile lookup", async () => {
    const { client } = setup({ user: { id: "u1" } });
    const { result } = run("/dashboard");
    await expect(result).resolves.toMatchObject({ kind: "next" });
    expect(client.from).not.toHaveBeenCalled();
  });
});

describe("updateSession admin gate", () => {
  it("redirects a non-admin on /admin to /dashboard", async () => {
    setup({ user: { id: "u1" }, tables: { profiles: { data: { role: "USER" } } } });
    const { result } = run("/admin/users");
    await expect(result).resolves.toEqual({ kind: "redirect", url: "https://app.example.com/dashboard" });
  });

  it("redirects when the profile cannot be loaded", async () => {
    setup({ user: { id: "u1" }, tables: { profiles: { data: null, error: { message: "x" } } } });
    const { result } = run("/admin");
    await expect(result).resolves.toEqual({ kind: "redirect", url: "https://app.example.com/dashboard" });
  });

  it("lets an admin through on /admin", async () => {
    setup({ user: { id: "admin-1" }, tables: { profiles: { data: { role: "ADMIN" } } } });
    const { result } = run("/admin/ledger");
    await expect(result).resolves.toMatchObject({ kind: "next" });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("looks up the role for the current user id", async () => {
    const { builders } = setup({ user: { id: "admin-1" }, tables: { profiles: { data: { role: "ADMIN" } } } });
    await run("/admin").result;
    expect(builders.profiles.select).toHaveBeenCalledWith("role");
    expect(builders.profiles.eq).toHaveBeenCalledWith("id", "admin-1");
  });
});

describe("updateSession client wiring", () => {
  it("creates the Supabase client with env url and anon key", async () => {
    setup({ user: null });
    await run("/").result;
    expect(createServerClientMock).toHaveBeenCalledWith(
      "https://proj.supabase.co",
      "anon-key",
      expect.objectContaining({ cookies: expect.any(Object) }),
    );
  });

  it("propagates MissingEnvError when env is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    setup();
    await expect(run("/dashboard").result).rejects.toThrow(/NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it("propagates errors thrown by getUser", async () => {
    const { client } = setup();
    client.auth.getUser.mockRejectedValue(new Error("auth down"));
    await expect(run("/dashboard").result).rejects.toThrow("auth down");
  });

  it("cookie adapter getAll reads the request cookies", async () => {
    setup({ user: null });
    const request = makeRequest("/", [{ name: "sb", value: "1" }]);
    await updateSession(request as never);
    const { cookies } = createServerClientMock.mock.calls[0][2];
    expect(cookies.getAll()).toEqual([{ name: "sb", value: "1" }]);
  });

  it("cookie adapter setAll writes to the request and to a fresh response", async () => {
    const request = makeRequest("/");
    const responses: { cookies: { set: ReturnType<typeof vi.fn> } }[] = [];
    nextMock.mockImplementation(() => {
      const res = { kind: "next", cookies: { set: vi.fn() } };
      responses.push(res);
      return res;
    });
    // Trigger setAll during getUser, as @supabase/ssr does when refreshing a token.
    const { client } = setup({ user: null });
    client.auth.getUser.mockImplementation((async () => {
      const { cookies } = createServerClientMock.mock.calls[0][2];
      cookies.setAll([{ name: "sb-token", value: "fresh", options: { path: "/" } }]);
      return { data: { user: null }, error: null };
    }) as never);

    const result = await updateSession(request as never);

    expect(request.cookies.set).toHaveBeenCalledWith("sb-token", "fresh");
    expect(responses).toHaveLength(2);
    expect(responses[1].cookies.set).toHaveBeenCalledWith("sb-token", "fresh", { path: "/" });
    // The returned response is the refreshed one so the new cookies reach the browser.
    expect(result).toBe(responses[1]);
  });
});
