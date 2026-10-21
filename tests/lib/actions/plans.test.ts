import { describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type SupabaseMockOptions } from "@tests/helpers/supabase";

const { createClientMock, revalidatePathMock, logErrorMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  logErrorMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next-intl/server", async () => (await import("@tests/helpers/utils")).nextIntlServerMock());
vi.mock("@/lib/logger", () => ({ logError: logErrorMock, logWarn: vi.fn() }));

import { activatePlan } from "@/lib/actions/plans";

const UNEXPECTED = { error: "Something went wrong. Please try again." };

function setup(options: SupabaseMockOptions = {}) {
  const mock = createSupabaseMock({ tables: { balances: { data: { available_balance: 1_000_000 } } }, ...options });
  createClientMock.mockResolvedValue(mock.client);
  return mock;
}

describe("activatePlan", () => {
  it("rejects an unknown plan id without touching the database", async () => {
    setup();
    await expect(activatePlan("does-not-exist")).resolves.toEqual({ error: "That plan could not be found." });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("returns 'signed in' error when there is no user", async () => {
    setup({ user: null });
    await expect(activatePlan("starter")).resolves.toEqual({ error: "You must be signed in." });
  });

  it.each([
    ["starter", 500],
    ["growth", 5000],
    ["elite", 25000],
  ])("activates %s when the available balance meets its %d minimum", async (planId, min) => {
    const { builders } = setup({ user: { id: "u-9" }, tables: { balances: { data: { available_balance: min } } } });
    await expect(activatePlan(planId)).resolves.toEqual({ success: true });
    expect(builders.profiles.update).toHaveBeenCalledWith({ active_plan: planId });
    expect(builders.profiles.eq).toHaveBeenCalledWith("id", "u-9");
  });

  it("rejects activation when the balance is a cent below the minimum", async () => {
    setup({ tables: { balances: { data: { available_balance: 499.99 } } } });
    await expect(activatePlan("starter")).resolves.toEqual({
      error: "Your available balance is below this plan's minimum deposit of $500.00.",
    });
  });

  it("does not write to the profile when the balance is insufficient", async () => {
    const { client } = setup({ tables: { balances: { data: { available_balance: 0 } } } });
    await activatePlan("growth");
    expect(client.from).not.toHaveBeenCalledWith("profiles");
  });

  it("treats a missing balances row as zero available balance", async () => {
    setup({ tables: { balances: { data: null } } });
    await expect(activatePlan("starter")).resolves.toEqual({
      error: "Your available balance is below this plan's minimum deposit of $500.00.",
    });
  });

  it("names the plan's own minimum, not another plan's, in the error", async () => {
    setup({ tables: { balances: { data: { available_balance: 5000 } } } });
    await expect(activatePlan("elite")).resolves.toEqual({
      error: "Your available balance is below this plan's minimum deposit of $25,000.00.",
    });
  });

  it("allows switching between two plans the balance already qualifies for", async () => {
    const { builders } = setup({ tables: { balances: { data: { available_balance: 10_000 } } } });
    await expect(activatePlan("growth")).resolves.toEqual({ success: true });
    await expect(activatePlan("starter")).resolves.toEqual({ success: true });
    expect(builders.profiles.update).toHaveBeenCalledTimes(2);
  });

  it("revalidates the dashboard layout on success", async () => {
    setup();
    await activatePlan("starter");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard", "layout");
  });

  it("does not revalidate when the plan is unknown, the user is signed out, or the balance is short", async () => {
    setup({ user: null });
    await activatePlan("starter");
    setup({ tables: { balances: { data: { available_balance: 0 } } } });
    await activatePlan("elite");
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("returns the database error and does not revalidate", async () => {
    setup({ tables: { profiles: { error: { message: "update failed" } }, balances: { data: { available_balance: 1_000_000 } } } });
    await expect(activatePlan("starter")).resolves.toEqual({ error: "update failed" });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("never trusts a client-supplied balance: re-reads it from the user's own row server-side", async () => {
    const { client } = setup({ tables: { balances: { data: { available_balance: 1_000_000 } } } });
    await activatePlan("elite");
    expect(client.from).toHaveBeenCalledWith("balances");
  });

  it("converts thrown exceptions into the friendly message and logs them", async () => {
    const boom = new Error("connection reset");
    createClientMock.mockRejectedValue(boom);
    await expect(activatePlan("starter")).resolves.toEqual(UNEXPECTED);
    expect(logErrorMock).toHaveBeenCalledWith("action:plans.activate", boom);
  });
});
