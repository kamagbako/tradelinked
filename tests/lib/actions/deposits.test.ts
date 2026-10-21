import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type SupabaseMockOptions } from "@tests/helpers/supabase";

const { createClientMock, revalidatePathMock, logErrorMock, approvedMock, rejectedMock, notifyIfLowBalanceMock } =
  vi.hoisted(() => ({
    createClientMock: vi.fn(),
    revalidatePathMock: vi.fn(),
    logErrorMock: vi.fn(),
    approvedMock: vi.fn(),
    rejectedMock: vi.fn(),
    notifyIfLowBalanceMock: vi.fn(),
  }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next-intl/server", async () => (await import("@tests/helpers/utils")).nextIntlServerMock());
vi.mock("@/lib/logger", () => ({ logError: logErrorMock, logWarn: vi.fn() }));
vi.mock("@/lib/email/notifications", () => ({
  sendDepositApprovedEmail: approvedMock,
  sendDepositRejectedEmail: rejectedMock,
}));
vi.mock("@/lib/balance-alerts", () => ({ notifyIfLowBalance: notifyIfLowBalanceMock }));

import { resolveDeposit, submitDeposit } from "@/lib/actions/deposits";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

function setup(options: SupabaseMockOptions = {}) {
  const mock = createSupabaseMock(options);
  createClientMock.mockResolvedValue(mock.client);
  return mock;
}

const UNEXPECTED = { error: "Something went wrong. Please try again." };

describe("submitDeposit", () => {
  beforeEach(() => {
    setup();
  });

  it("rejects a missing, zero, negative or non-numeric amount", async () => {
    const message = { error: "Enter the amount you deposited." };
    await expect(submitDeposit(form({}))).resolves.toEqual(message);
    await expect(submitDeposit(form({ amount: "0" }))).resolves.toEqual(message);
    await expect(submitDeposit(form({ amount: "-5" }))).resolves.toEqual(message);
    await expect(submitDeposit(form({ amount: "abc" }))).resolves.toEqual(message);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("returns 'signed in' error when there is no user", async () => {
    setup({ user: null });
    await expect(submitDeposit(form({ amount: "10" }))).resolves.toEqual({
      error: "You must be signed in.",
    });
  });

  it("deposits are always Bitcoin: inserts method BTC regardless of what the form claims", async () => {
    const { builders } = setup({ user: { id: "u-9" } });
    await expect(submitDeposit(form({ amount: "250.5", method: "USDT", reference: "  TX123 " }))).resolves.toEqual({
      success: true,
    });
    expect(createClientMock).toHaveBeenCalled();
    expect(builders.deposits.insert).toHaveBeenCalledWith({
      user_id: "u-9",
      amount: 250.5,
      method: "BTC",
      reference: "TX123",
    });
  });

  it("stores a blank or missing reference as null", async () => {
    const { builders } = setup();
    await submitDeposit(form({ amount: "10", reference: "   " }));
    expect(builders.deposits.insert).toHaveBeenLastCalledWith(expect.objectContaining({ reference: null }));
    await submitDeposit(form({ amount: "10" }));
    expect(builders.deposits.insert).toHaveBeenLastCalledWith(expect.objectContaining({ reference: null }));
  });

  it("revalidates the dashboard layout on success", async () => {
    await submitDeposit(form({ amount: "10" }));
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard", "layout");
  });

  it("returns the database error message and does not revalidate", async () => {
    setup({ tables: { deposits: { error: { message: "insert failed" } } } });
    await expect(submitDeposit(form({ amount: "10" }))).resolves.toEqual({ error: "insert failed" });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("converts thrown exceptions into the friendly message and logs them", async () => {
    const boom = new Error("connection reset");
    createClientMock.mockRejectedValue(boom);
    await expect(submitDeposit(form({ amount: "10" }))).resolves.toEqual(UNEXPECTED);
    expect(logErrorMock).toHaveBeenCalledWith("action:deposits.submit", boom);
  });

  describe("deposit limits", () => {
    const limits = { deposit_min_usd: 50, deposit_max_usd: 5000 };

    it("rejects an amount below the configured minimum", async () => {
      setup({ tables: { company_settings: { data: limits } } });
      await expect(submitDeposit(form({ amount: "49.99" }))).resolves.toEqual({
        error: "Enter an amount between $50.00 and $5,000.00.",
      });
    });

    it("rejects an amount above the configured maximum", async () => {
      setup({ tables: { company_settings: { data: limits } } });
      await expect(submitDeposit(form({ amount: "5000.01" }))).resolves.toEqual({
        error: "Enter an amount between $50.00 and $5,000.00.",
      });
    });

    it("accepts an amount exactly at the minimum or maximum boundary", async () => {
      const { builders } = setup({ tables: { company_settings: { data: limits } } });
      await expect(submitDeposit(form({ amount: "50" }))).resolves.toEqual({ success: true });
      await expect(submitDeposit(form({ amount: "5000" }))).resolves.toEqual({ success: true });
      expect(builders.deposits.insert).toHaveBeenCalledTimes(2);
    });

    it("does not insert the deposit when the amount is outside the configured limits", async () => {
      const { client } = setup({ tables: { company_settings: { data: limits } } });
      await submitDeposit(form({ amount: "1" }));
      expect(client.from).not.toHaveBeenCalledWith("deposits");
    });

    it("treats a missing company_settings row as having no limit", async () => {
      const { builders } = setup({ tables: { company_settings: { data: null } } });
      await expect(submitDeposit(form({ amount: "999999999" }))).resolves.toEqual({ success: true });
      expect(builders.deposits.insert).toHaveBeenCalled();
    });

    it("checks limits server-side, independent of what a tampered client sends", async () => {
      // The action takes no "min"/"max" input from the form at all — only `amount`.
      setup({ tables: { company_settings: { data: limits } } });
      await expect(
        submitDeposit(form({ amount: "1", minUsd: "0", maxUsd: "1000000" })),
      ).resolves.toEqual({ error: "Enter an amount between $50.00 and $5,000.00." });
    });
  });
});

describe("resolveDeposit blank reasons", () => {
  it.each([["empty", ""], ["whitespace", "   "], ["undefined", undefined]])(
    "stores null for a %s rejection reason",
    async (_label, reason) => {
      const { client } = setup();
      await resolveDeposit("dep-9", "REJECTED", reason);
      expect(client.rpc).toHaveBeenCalledWith("resolve_deposit", expect.objectContaining({ p_rejection_reason: null }));
    },
  );

  it("trims a real rejection reason", async () => {
    const { client } = setup();
    await resolveDeposit("dep-9", "REJECTED", "  No matching transfer  ");
    expect(client.rpc).toHaveBeenCalledWith(
      "resolve_deposit",
      expect.objectContaining({ p_rejection_reason: "No matching transfer" }),
    );
  });
});

describe("resolveDeposit", () => {
  it("calls the resolve_deposit RPC with the approved status and null reason", async () => {
    const { client } = setup();
    await expect(resolveDeposit("dep-1", "APPROVED")).resolves.toEqual({ success: true });
    expect(client.rpc).toHaveBeenCalledWith("resolve_deposit", {
      p_deposit_id: "dep-1",
      p_status: "APPROVED",
      p_rejection_reason: null,
    });
  });

  it("forwards a rejection reason", async () => {
    const { client } = setup();
    await resolveDeposit("dep-2", "REJECTED", "No matching transfer");
    expect(client.rpc).toHaveBeenCalledWith("resolve_deposit", {
      p_deposit_id: "dep-2",
      p_status: "REJECTED",
      p_rejection_reason: "No matching transfer",
    });
  });

  it("revalidates the admin deposits page and dashboard layout", async () => {
    setup();
    await resolveDeposit("dep-1", "APPROVED");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/deposits");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard", "layout");
  });

  it("returns the RPC error and does not revalidate", async () => {
    const { client } = setup();
    client.rpc.mockResolvedValue({ data: null, error: { message: "already resolved" } });
    await expect(resolveDeposit("dep-1", "APPROVED")).resolves.toEqual({ error: "already resolved" });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("converts thrown exceptions into the friendly message and logs them", async () => {
    const { client } = setup();
    const boom = new Error("rpc crashed");
    client.rpc.mockRejectedValue(boom);
    await expect(resolveDeposit("dep-1", "APPROVED")).resolves.toEqual(UNEXPECTED);
    expect(logErrorMock).toHaveBeenCalledWith("action:deposits.resolve", boom);
  });
});

describe("resolveDeposit notifications", () => {
  const approvedDeposit = {
    user_id: "user-9",
    amount: 500,
    profiles: { email: "depositor@example.com" },
  };

  it("emails the depositor and checks the low-balance threshold on approval", async () => {
    const { builders } = setup({ tables: { deposits: { data: approvedDeposit } } });
    await resolveDeposit("dep-1", "APPROVED");
    expect(builders.deposits.select).toHaveBeenCalledWith("*, profiles(email)");
    expect(approvedMock).toHaveBeenCalledWith({ userEmail: "depositor@example.com", amount: 500 });
    expect(notifyIfLowBalanceMock).toHaveBeenCalledWith("user-9");
    expect(rejectedMock).not.toHaveBeenCalled();
  });

  it("emails the depositor the rejection reason and the support url, without checking the balance", async () => {
    setup({
      tables: {
        deposits: { data: { ...approvedDeposit, user_id: "user-9" } },
        company_settings: { data: { whatsapp_support_url: "https://wa.me/123" } },
      },
    });
    await resolveDeposit("dep-1", "REJECTED", "No matching transfer");
    expect(rejectedMock).toHaveBeenCalledWith({
      userEmail: "depositor@example.com",
      amount: 500,
      reason: "No matching transfer",
      supportUrl: "https://wa.me/123",
    });
    expect(approvedMock).not.toHaveBeenCalled();
    expect(notifyIfLowBalanceMock).not.toHaveBeenCalled();
  });

  it("emails 'Not specified.' for a blank rejection reason", async () => {
    setup({ tables: { deposits: { data: approvedDeposit } } });
    await resolveDeposit("dep-1", "REJECTED");
    expect(rejectedMock).toHaveBeenCalledWith(expect.objectContaining({ reason: "Not specified." }));
  });

  it("falls back to NEXT_PUBLIC_WHATSAPP_SUPPORT_URL when settings have no url", async () => {
    vi.stubEnv("NEXT_PUBLIC_WHATSAPP_SUPPORT_URL", "https://env.example/support");
    setup({ tables: { deposits: { data: approvedDeposit }, company_settings: { data: null } } });
    await resolveDeposit("dep-1", "REJECTED", "r");
    expect(rejectedMock).toHaveBeenCalledWith(expect.objectContaining({ supportUrl: "https://env.example/support" }));
    vi.unstubAllEnvs();
  });

  it("sends no email and does not check the balance when the deposit has no profile email", async () => {
    setup({ tables: { deposits: { data: { ...approvedDeposit, profiles: null } } } });
    await expect(resolveDeposit("dep-1", "APPROVED")).resolves.toEqual({ success: true });
    expect(approvedMock).not.toHaveBeenCalled();
    expect(notifyIfLowBalanceMock).not.toHaveBeenCalled();
  });

  it("sends no email when the deposit lookup comes back empty", async () => {
    setup({ tables: { deposits: { data: null } } });
    await expect(resolveDeposit("dep-1", "APPROVED")).resolves.toEqual({ success: true });
    expect(approvedMock).not.toHaveBeenCalled();
    expect(notifyIfLowBalanceMock).not.toHaveBeenCalled();
  });
});
