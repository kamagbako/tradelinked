// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/health/route";

const fetchMock = vi.fn();

function setEnv({ url = "https://x.supabase.co", anon = "anon-key", service = "service-key", resend = "" } = {}) {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", anon);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", service);
  vi.stubEnv("RESEND_API_KEY", resend);
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 200 });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GET /api/health", () => {
  it("returns 200 and ok when everything is configured and Supabase answers", async () => {
    setEnv();
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.checks.supabaseConfig.ok).toBe(true);
    expect(body.checks.serviceRoleKey.ok).toBe(true);
    expect(body.checks.supabaseReachable.ok).toBe(true);
  });

  it("calls the Supabase auth health endpoint with the anon key", async () => {
    setEnv();
    await GET();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://x.supabase.co/auth/v1/health");
    expect(init.headers).toEqual({ apikey: "anon-key" });
  });

  it("is never cached", async () => {
    setEnv();
    const res = await GET();
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 503 and names the missing Supabase variables", async () => {
    setEnv({ url: "", anon: "" });
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.checks.supabaseConfig.ok).toBe(false);
    expect(body.checks.supabaseConfig.detail).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(body.checks.supabaseConfig.detail).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });

  it("skips the reachability probe when Supabase is not configured", async () => {
    setEnv({ url: "", anon: "" });
    const body = await (await GET()).json();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(body.checks.supabaseReachable).toEqual({ ok: false, detail: "Skipped: Supabase is not configured." });
  });

  it("flags a malformed Supabase URL", async () => {
    setEnv({ url: "x.supabase.co" });
    const body = await (await GET()).json();
    expect(body.checks.supabaseConfig.ok).toBe(false);
    expect(body.checks.supabaseConfig.detail).toMatch(/include https:\/\//);
  });

  it("flags a missing service role key", async () => {
    setEnv({ service: "" });
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.checks.serviceRoleKey.ok).toBe(false);
    expect(body.checks.serviceRoleKey.detail).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("reports a rejected key/URL when Supabase answers with an error status", async () => {
    setEnv();
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.checks.supabaseReachable.ok).toBe(false);
    expect(body.checks.supabaseReachable.detail).toContain("401");
  });

  it("reports unreachable when the request fails or times out", async () => {
    setEnv();
    fetchMock.mockRejectedValue(new Error("network down"));
    const body = await (await GET()).json();
    expect(body.checks.supabaseReachable.ok).toBe(false);
    expect(body.checks.supabaseReachable.detail).toMatch(/Could not reach Supabase/);
  });

  it("treats email as optional: unset still passes but is noted", async () => {
    setEnv({ resend: "" });
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.checks.email.ok).toBe(true);
    expect(body.checks.email.detail).toContain("RESEND_API_KEY");
  });

  it("does not note anything when email is configured", async () => {
    setEnv({ resend: "re_123" });
    const body = await (await GET()).json();
    expect(body.checks.email).toEqual({ ok: true });
  });

  it("never leaks secret values in the response", async () => {
    setEnv({ anon: "ANON-SECRET-123", service: "SERVICE-SECRET-456", resend: "RESEND-SECRET-789" });
    const text = JSON.stringify(await (await GET()).json());
    for (const secret of ["ANON-SECRET-123", "SERVICE-SECRET-456", "RESEND-SECRET-789"]) {
      expect(text).not.toContain(secret);
    }
  });
});
