import { beforeEach, describe, expect, it, vi } from "vitest";
import { RedirectSignal, createSupabaseMock } from "@tests/helpers/supabase";

const { createClientMock, redirectMock, logErrorMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  redirectMock: vi.fn(),
  logErrorMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next-intl/server", async () => (await import("@tests/helpers/utils")).nextIntlServerMock());
vi.mock("@/lib/logger", () => ({ logError: logErrorMock, logWarn: vi.fn() }));

import { signIn, signOut, signUp } from "@/lib/actions/auth";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

let supabase: ReturnType<typeof createSupabaseMock>["client"];

beforeEach(() => {
  redirectMock.mockImplementation((url: string) => {
    throw new RedirectSignal(url);
  });
  supabase = createSupabaseMock().client;
  createClientMock.mockResolvedValue(supabase);
});

async function expectRedirect(promise: Promise<unknown>, url: string) {
  await expect(promise).rejects.toMatchObject({ url });
}

describe("signIn", () => {
  const valid = { email: "  user@example.com ", password: "secret123" };

  it("requires email and password", async () => {
    const message = "Email and password are required.";
    await expect(signIn(form({ email: "", password: "x" }))).resolves.toEqual({ error: message });
    await expect(signIn(form({ email: "a@b.co", password: "" }))).resolves.toEqual({ error: message });
    await expect(signIn(form({}))).resolves.toEqual({ error: message });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("treats a whitespace-only email as missing", async () => {
    await expect(signIn(form({ email: "   ", password: "x" }))).resolves.toEqual({
      error: "Email and password are required.",
    });
  });

  it("trims the email and passes the raw password", async () => {
    supabase.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal1" },
      error: null,
    } as never);
    await expectRedirect(signIn(form(valid)), "/dashboard");
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "secret123",
    });
  });

  it("returns the Supabase error message on failed sign-in and does not redirect", async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: { message: "Invalid login credentials" } } as never);
    await expect(signIn(form(valid))).resolves.toEqual({ error: "Invalid login credentials" });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects to /login/mfa when a second factor is required and not yet satisfied", async () => {
    supabase.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal2" },
      error: null,
    } as never);
    await expectRedirect(signIn(form(valid)), "/login/mfa");
  });

  it("redirects to /dashboard when aal2 is already satisfied", async () => {
    supabase.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal2", nextLevel: "aal2" },
      error: null,
    } as never);
    await expectRedirect(signIn(form(valid)), "/dashboard");
  });

  it("redirects to /dashboard when the user has no MFA", async () => {
    await expectRedirect(signIn(form(valid)), "/dashboard");
  });

  it("redirects an admin straight to /admin instead of /dashboard", async () => {
    supabase = createSupabaseMock({ tables: { profiles: { data: { role: "ADMIN" } } } }).client;
    createClientMock.mockResolvedValue(supabase);
    await expectRedirect(signIn(form(valid)), "/admin");
  });

  it("looks up the signed-in user's own role to decide the destination", async () => {
    supabase = createSupabaseMock({ user: { id: "admin-7" }, tables: { profiles: { data: { role: "ADMIN" } } } }).client;
    createClientMock.mockResolvedValue(supabase);
    await signIn(form(valid)).catch(() => {});
    expect(supabase.from).toHaveBeenCalledWith("profiles");
  });

  it("re-throws the redirect signal rather than swallowing it", async () => {
    const err = await signIn(form(valid)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RedirectSignal);
    expect(logErrorMock).not.toHaveBeenCalled();
  });

  it("converts unexpected exceptions into the friendly message and logs them", async () => {
    const boom = new Error("network down");
    createClientMock.mockRejectedValue(boom);
    await expect(signIn(form(valid))).resolves.toEqual({ error: "Something went wrong. Please try again." });
    expect(logErrorMock).toHaveBeenCalledWith("action:auth.signIn", boom);
  });

  it("converts a throwing auth call into the friendly message", async () => {
    supabase.auth.signInWithPassword.mockRejectedValue(new Error("fetch failed"));
    await expect(signIn(form(valid))).resolves.toEqual({ error: "Something went wrong. Please try again." });
    expect(logErrorMock).toHaveBeenCalledTimes(1);
  });
});

describe("signUp", () => {
  const valid = {
    fullName: "  Ada Lovelace ",
    email: " ada@example.com ",
    password: "abcdefg1",
    confirmPassword: "abcdefg1",
    acceptTerms: "on",
  };

  it("requires a full name", async () => {
    await expect(signUp(form({ ...valid, fullName: "  " }))).resolves.toEqual({ error: "Please enter your full name." });
  });

  it("validates the email", async () => {
    await expect(signUp(form({ ...valid, email: "nope" }))).resolves.toEqual({
      error: "Please enter a valid email address.",
    });
  });

  it("rejects weak passwords", async () => {
    const message = "Password must be 8+ characters and include a letter and a number.";
    await expect(signUp(form({ ...valid, password: "short1", confirmPassword: "short1" }))).resolves.toEqual({ error: message });
    await expect(signUp(form({ ...valid, password: "onlyletters", confirmPassword: "onlyletters" }))).resolves.toEqual({ error: message });
    await expect(signUp(form({ ...valid, password: "1234567890", confirmPassword: "1234567890" }))).resolves.toEqual({ error: message });
  });

  it("rejects mismatched passwords", async () => {
    await expect(signUp(form({ ...valid, confirmPassword: "different1" }))).resolves.toEqual({
      error: "Passwords do not match.",
    });
  });

  it("requires accepting the terms (checkbox value must be 'on')", async () => {
    const message = "You must accept the Terms, Privacy Policy and Forex Risk Disclosure to continue.";
    await expect(signUp(form({ ...valid, acceptTerms: "" }))).resolves.toEqual({ error: message });
    await expect(signUp(form({ ...valid, acceptTerms: "true" }))).resolves.toEqual({ error: message });
    const { acceptTerms: _omit, ...rest } = valid;
    void _omit;
    await expect(signUp(form(rest))).resolves.toEqual({ error: message });
  });

  it("checks validations in order: name, email, password, mismatch, terms", async () => {
    await expect(signUp(form({}))).resolves.toEqual({ error: "Please enter your full name." });
    await expect(signUp(form({ fullName: "A" }))).resolves.toEqual({ error: "Please enter a valid email address." });
    await expect(signUp(form({ fullName: "A", email: "a@b.co" }))).resolves.toEqual({
      error: "Password must be 8+ characters and include a letter and a number.",
    });
  });

  it("does not touch Supabase when validation fails", async () => {
    await signUp(form({ ...valid, fullName: "" }));
    expect(createClientMock).not.toHaveBeenCalled();
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });

  it("signs up with trimmed values and full_name metadata, then redirects to /dashboard", async () => {
    await expectRedirect(signUp(form(valid)), "/dashboard");
    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: "ada@example.com",
      password: "abcdefg1",
      options: { data: { full_name: "Ada Lovelace" } },
    });
  });

  it("returns the Supabase error message and does not redirect", async () => {
    supabase.auth.signUp.mockResolvedValue({ data: {}, error: { message: "User already registered" } } as never);
    await expect(signUp(form(valid))).resolves.toEqual({ error: "User already registered" });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("re-throws the redirect signal", async () => {
    const err = await signUp(form(valid)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RedirectSignal);
    expect(logErrorMock).not.toHaveBeenCalled();
  });

  it("converts unexpected exceptions into the friendly message and logs them", async () => {
    const boom = new Error("boom");
    supabase.auth.signUp.mockRejectedValue(boom);
    await expect(signUp(form(valid))).resolves.toEqual({ error: "Something went wrong. Please try again." });
    expect(logErrorMock).toHaveBeenCalledWith("action:auth.signUp", boom);
  });
});

describe("signOut", () => {
  it("signs out and redirects to /login", async () => {
    await expectRedirect(signOut(), "/login");
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    expect(logErrorMock).not.toHaveBeenCalled();
  });

  it("still redirects to /login and logs when sign-out throws", async () => {
    const boom = new Error("auth server unreachable");
    supabase.auth.signOut.mockRejectedValue(boom);
    await expectRedirect(signOut(), "/login");
    expect(logErrorMock).toHaveBeenCalledWith("action:auth.signOut", boom);
  });

  it("still redirects to /login when the client cannot be created", async () => {
    createClientMock.mockRejectedValue(new Error("missing env"));
    await expectRedirect(signOut(), "/login");
    expect(logErrorMock).toHaveBeenCalledTimes(1);
  });
});
