import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateSessionMock, logErrorMock, nextMock, redirectMock } = vi.hoisted(() => ({
  updateSessionMock: vi.fn(),
  logErrorMock: vi.fn(),
  nextMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("@/lib/supabase/middleware", () => ({ updateSession: updateSessionMock }));
vi.mock("@/lib/logger", () => ({ logError: logErrorMock, logWarn: vi.fn() }));
vi.mock("next/server", () => ({ NextResponse: { next: nextMock, redirect: redirectMock } }));

import { config, middleware } from "@/middleware";

function makeRequest(pathname: string) {
  return { url: `https://app.example.com${pathname}`, nextUrl: { pathname } };
}

beforeEach(() => {
  nextMock.mockImplementation(() => ({ kind: "next" }));
  redirectMock.mockImplementation((url: URL) => ({ kind: "redirect", url: url.toString() }));
});

describe("middleware", () => {
  it("returns whatever updateSession returns on success", async () => {
    const response = { kind: "session" };
    updateSessionMock.mockResolvedValue(response);
    const request = makeRequest("/dashboard");
    await expect(middleware(request as never)).resolves.toBe(response);
    expect(updateSessionMock).toHaveBeenCalledWith(request);
    expect(logErrorMock).not.toHaveBeenCalled();
  });

  it.each(["/dashboard", "/dashboard/deposit", "/admin", "/admin/users"])(
    "fails closed: redirects %s to /login when updateSession throws",
    async (path) => {
      updateSessionMock.mockRejectedValue(new Error("auth backend down"));
      await expect(middleware(makeRequest(path) as never)).resolves.toEqual({
        kind: "redirect",
        url: "https://app.example.com/login",
      });
    },
  );

  it.each(["/login", "/register", "/"])("fails open: continues on %s when updateSession throws", async (path) => {
    updateSessionMock.mockRejectedValue(new Error("auth backend down"));
    await expect(middleware(makeRequest(path) as never)).resolves.toEqual({ kind: "next" });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("logs the error with the path", async () => {
    const boom = new Error("missing env");
    updateSessionMock.mockRejectedValue(boom);
    await middleware(makeRequest("/admin/x") as never);
    expect(logErrorMock).toHaveBeenCalledWith("middleware", boom, { path: "/admin/x" });
  });

  it("also fails closed when a non-Error value is thrown", async () => {
    updateSessionMock.mockRejectedValue("nope");
    await expect(middleware(makeRequest("/dashboard") as never)).resolves.toMatchObject({ kind: "redirect" });
    expect(logErrorMock).toHaveBeenCalledWith("middleware", "nope", { path: "/dashboard" });
  });
});

describe("middleware config", () => {
  it("only runs on auth-aware routes", () => {
    expect(config.matcher).toEqual(["/dashboard/:path*", "/admin/:path*", "/login", "/register"]);
  });
});
