import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { ResendMock } = vi.hoisted(() => ({
  ResendMock: vi.fn(function (this: { apiKey: string }, apiKey: string) {
    this.apiKey = apiKey;
  }),
}));

vi.mock("resend", () => ({ Resend: ResendMock }));

async function load() {
  vi.resetModules();
  return import("@/lib/email/resend");
}

beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("RESEND_FROM_EMAIL", "");
  vi.stubEnv("ADMIN_NOTIFICATION_EMAIL", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getResend", () => {
  it("returns null and does not construct a client without RESEND_API_KEY", async () => {
    const { getResend } = await load();
    expect(getResend()).toBeNull();
    expect(ResendMock).not.toHaveBeenCalled();
  });

  it("creates a client with the API key", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_123");
    const { getResend } = await load();
    const client = getResend();
    expect(client).not.toBeNull();
    expect(ResendMock).toHaveBeenCalledTimes(1);
    expect(ResendMock).toHaveBeenCalledWith("re_test_123");
  });

  it("caches the client across calls", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_123");
    const { getResend } = await load();
    expect(getResend()).toBe(getResend());
    expect(ResendMock).toHaveBeenCalledTimes(1);
  });

  it("does not create a client at import time", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_123");
    await load();
    expect(ResendMock).not.toHaveBeenCalled();
  });

  it("reads the API key lazily, so a key set after import is picked up", async () => {
    const { getResend } = await load();
    expect(getResend()).toBeNull();
    vi.stubEnv("RESEND_API_KEY", "late-key");
    expect(getResend()).not.toBeNull();
    expect(ResendMock).toHaveBeenCalledWith("late-key");
  });
});

describe("email constants", () => {
  it("defaults EMAIL_FROM and ADMIN_EMAIL", async () => {
    vi.unstubAllEnvs();
    delete process.env.RESEND_FROM_EMAIL;
    delete process.env.ADMIN_NOTIFICATION_EMAIL;
    const { EMAIL_FROM, ADMIN_EMAIL } = await load();
    expect(EMAIL_FROM).toBe("TradeLinked <notifications@tradelinked.app>");
    expect(ADMIN_EMAIL).toBe("");
  });

  it("reads EMAIL_FROM and ADMIN_EMAIL from the environment", async () => {
    vi.stubEnv("RESEND_FROM_EMAIL", "Acme <hi@acme.test>");
    vi.stubEnv("ADMIN_NOTIFICATION_EMAIL", "admin@acme.test");
    const { EMAIL_FROM, ADMIN_EMAIL } = await load();
    expect(EMAIL_FROM).toBe("Acme <hi@acme.test>");
    expect(ADMIN_EMAIL).toBe("admin@acme.test");
  });
});
