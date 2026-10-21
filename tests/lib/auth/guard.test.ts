import { beforeEach, describe, expect, it, vi } from "vitest";
import { RedirectSignal, createSupabaseMock, type SupabaseMockOptions } from "@tests/helpers/supabase";

const { createClientMock, redirectMock } = vi.hoisted(() => ({ createClientMock: vi.fn(), redirectMock: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import { requireUser } from "@/lib/auth/guard";

function setup(options: SupabaseMockOptions = {}) {
  const mock = createSupabaseMock(options);
  createClientMock.mockResolvedValue(mock.client);
  return mock;
}

beforeEach(() => {
  redirectMock.mockImplementation((url: string) => {
    throw new RedirectSignal(url);
  });
});

describe("requireUser", () => {
  it("redirects to /login when there is no user", async () => {
    setup({ user: null });
    await expect(requireUser()).rejects.toMatchObject({ url: "/login" });
  });

  it("does not check the assurance level when there is no user", async () => {
    const { client } = setup({ user: null });
    await requireUser().catch(() => {});
    expect(client.auth.mfa.getAuthenticatorAssuranceLevel).not.toHaveBeenCalled();
  });

  it("redirects to /login/mfa when aal2 is required but not satisfied", async () => {
    setup({ aal: { currentLevel: "aal1", nextLevel: "aal2" } });
    await expect(requireUser()).rejects.toMatchObject({ url: "/login/mfa" });
  });

  it("returns supabase and user when aal2 is satisfied", async () => {
    const { client } = setup({ user: { id: "u1", email: "a@b.co" }, aal: { currentLevel: "aal2", nextLevel: "aal2" } });
    const result = await requireUser();
    expect(result.user).toEqual({ id: "u1", email: "a@b.co" });
    expect(result.supabase).toBe(client);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("returns supabase and user when the user has no MFA (aal1/aal1)", async () => {
    setup({ aal: { currentLevel: "aal1", nextLevel: "aal1" } });
    await expect(requireUser()).resolves.toMatchObject({ user: { id: "user-1" } });
  });

  it("returns the user when the assurance level is unavailable (null)", async () => {
    setup({ aal: null });
    await expect(requireUser()).resolves.toMatchObject({ user: { id: "user-1" } });
  });
});
