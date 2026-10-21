import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type SupabaseMockOptions } from "@tests/helpers/supabase";

const {
  createClientMock,
  revalidatePathMock,
  logErrorMock,
  requestedMock,
  approvedMock,
  rejectedMock,
  notifyIfLowBalanceMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  logErrorMock: vi.fn(),
  requestedMock: vi.fn(),
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
  sendWithdrawalRequestedEmail: requestedMock,
  sendWithdrawalApprovedEmail: approvedMock,
  sendWithdrawalRejectedEmail: rejectedMock,
}));
vi.mock("@/lib/balance-alerts", () => ({ notifyIfLowBalance: notifyIfLowBalanceMock }));

import { resolveWithdrawal, submitWithdrawal } from "@/lib/actions/withdrawals";

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
const validForm = { amount: "100", payoutMethod: "BTC", payoutDetails: " bc1qxyz " };

describe("submitWithdrawal", () => {
  beforeEach(() => {
    setup();
  });

  it("rejects a missing, zero, negative or non-numeric amount", async () => {
    const message = { error: "Enter a valid withdrawal amount." };
    await expect(submitWithdrawal(form({ ...validForm, amount: "" }))).resolves.toEqual(message);
    await expect(submitWithdrawal(form({ ...validForm, amount: "0" }))).resolves.toEqual(message);
    await expect(submitWithdrawal(form({ ...validForm, amount: "-1" }))).resolves.toEqual(message);
    await expect(submitWithdrawal(form({ ...validForm, amount: "xyz" }))).resolves.toEqual(message);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("requires a payout method and payout details", async () => {
    const message = { error: "Payout method and details are required." };
    await expect(submitWithdrawal(form({ ...validForm, payoutMethod: "" }))).resolves.toEqual(message);
    await expect(submitWithdrawal(form({ ...validForm, payoutDetails: "   " }))).resolves.toEqual(message);
    await expect(submitWithdrawal(form({ amount: "5" }))).resolves.toEqual(message);
  });

  it("returns 'signed in' error when there is no user", async () => {
    setup({ user: null });
    await expect(submitWithdrawal(form(validForm))).resolves.toEqual({ error: "You must be signed in." });
  });

  it("returns 'signed in' error when getUser reports an error", async () => {
    setup({ authError: { message: "jwt expired" } });
    await expect(submitWithdrawal(form(validForm))).resolves.toEqual({ error: "You must be signed in." });
  });

  it("calls request_withdrawal with trimmed details, emails the user and revalidates", async () => {
    const { client } = setup({ user: { id: "u1", email: "me@example.com" } });
    await expect(submitWithdrawal(form(validForm))).resolves.toEqual({ success: true });
    expect(client.rpc).toHaveBeenCalledWith("request_withdrawal", {
      p_amount: 100,
      p_payout_method: "BTC",
      p_payout_details: "bc1qxyz",
    });
    expect(requestedMock).toHaveBeenCalledWith({ userEmail: "me@example.com", amount: 100, payoutMethod: "BTC" });
    expect(notifyIfLowBalanceMock).toHaveBeenCalledWith("u1");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard", "layout");
  });

  it("returns the RPC error without sending email or revalidating", async () => {
    const { client } = setup();
    client.rpc.mockResolvedValue({ data: null, error: { message: "Insufficient balance" } });
    await expect(submitWithdrawal(form(validForm))).resolves.toEqual({ error: "Insufficient balance" });
    expect(requestedMock).not.toHaveBeenCalled();
    expect(notifyIfLowBalanceMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("converts thrown exceptions into the friendly message and logs them", async () => {
    const boom = new Error("boom");
    createClientMock.mockRejectedValue(boom);
    await expect(submitWithdrawal(form(validForm))).resolves.toEqual(UNEXPECTED);
    expect(logErrorMock).toHaveBeenCalledWith("action:withdrawals.submit", boom);
  });

  it("converts a failing email send into the friendly message (email is awaited)", async () => {
    requestedMock.mockRejectedValueOnce(new Error("smtp"));
    await expect(submitWithdrawal(form(validForm))).resolves.toEqual(UNEXPECTED);
    expect(logErrorMock).toHaveBeenCalledTimes(1);
  });
});

describe("resolveWithdrawal", () => {
  const pending = {
    id: "w1",
    user_id: "owner-1",
    status: "PENDING",
    amount: 250,
    payout_method: "USDT",
    profiles: { email: "owner@example.com", full_name: "Owner" },
  };

  it("rejects PENDING as a target status without touching the database", async () => {
    await expect(resolveWithdrawal("w1", "PENDING")).resolves.toEqual({ error: "Invalid target status." });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("returns 'not found' when the lookup errors", async () => {
    setup({ tables: { withdrawals: { data: null, error: { message: "no rows" } } } });
    await expect(resolveWithdrawal("w1", "COMPLETED")).resolves.toEqual({ error: "Withdrawal not found." });
  });

  it("returns 'not found' when no row is returned", async () => {
    setup({ tables: { withdrawals: { data: null } } });
    await expect(resolveWithdrawal("w1", "COMPLETED")).resolves.toEqual({ error: "Withdrawal not found." });
  });

  it("refuses to resolve a withdrawal that is no longer pending", async () => {
    const { client } = setup({ tables: { withdrawals: { data: { ...pending, status: "COMPLETED" } } } });
    await expect(resolveWithdrawal("w1", "REJECTED")).resolves.toEqual({
      error: "This withdrawal has already been resolved.",
    });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("looks the withdrawal up by id with its profile", async () => {
    const { builders } = setup({ tables: { withdrawals: { data: pending } } });
    await resolveWithdrawal("w1", "COMPLETED");
    expect(builders.withdrawals.select).toHaveBeenCalledWith("*, profiles(email, full_name)");
    expect(builders.withdrawals.eq).toHaveBeenCalledWith("id", "w1");
  });

  it("approves: calls the RPC, emails the user, revalidates", async () => {
    const { client } = setup({ tables: { withdrawals: { data: pending } } });
    await expect(resolveWithdrawal("w1", "COMPLETED")).resolves.toEqual({ success: true });
    expect(client.rpc).toHaveBeenCalledWith("resolve_withdrawal", {
      p_withdrawal_id: "w1",
      p_status: "COMPLETED",
      p_rejection_reason: null,
    });
    expect(approvedMock).toHaveBeenCalledWith({ userEmail: "owner@example.com", amount: 250, payoutMethod: "USDT" });
    expect(rejectedMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/withdrawals");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard", "layout");
  });

  it("does not check the low-balance threshold on approval (the balance was already debited at request time)", async () => {
    setup({ tables: { withdrawals: { data: pending } } });
    await resolveWithdrawal("w1", "COMPLETED");
    expect(notifyIfLowBalanceMock).not.toHaveBeenCalled();
  });

  it("rejects: forwards the reason, uses the settings support URL in the email", async () => {
    const { client } = setup({
      tables: {
        withdrawals: { data: pending },
        company_settings: { data: { whatsapp_support_url: "https://wa.me/123" } },
      },
    });
    await expect(resolveWithdrawal("w1", "REJECTED", "Bad address")).resolves.toEqual({ success: true });
    expect(client.rpc).toHaveBeenCalledWith("resolve_withdrawal", {
      p_withdrawal_id: "w1",
      p_status: "REJECTED",
      p_rejection_reason: "Bad address",
    });
    expect(rejectedMock).toHaveBeenCalledWith({
      userEmail: "owner@example.com",
      amount: 250,
      reason: "Bad address",
      supportUrl: "https://wa.me/123",
    });
    expect(approvedMock).not.toHaveBeenCalled();
    expect(notifyIfLowBalanceMock).toHaveBeenCalledWith("owner-1");
  });

  it("rejects with no reason: emails 'Not specified.'", async () => {
    setup({ tables: { withdrawals: { data: pending }, company_settings: { data: { whatsapp_support_url: "u" } } } });
    await resolveWithdrawal("w1", "REJECTED");
    expect(rejectedMock).toHaveBeenCalledWith(expect.objectContaining({ reason: "Not specified." }));
  });

  it("treats a blank reason as no reason: emails 'Not specified.' and stores null", async () => {
    const { client } = setup({
      tables: { withdrawals: { data: pending }, company_settings: { data: { whatsapp_support_url: "u" } } },
    });
    await resolveWithdrawal("w1", "REJECTED", "   ");
    expect(rejectedMock).toHaveBeenCalledWith(expect.objectContaining({ reason: "Not specified." }));
    expect(client.rpc).toHaveBeenCalledWith("resolve_withdrawal", expect.objectContaining({ p_rejection_reason: null }));
  });

  it("falls back to NEXT_PUBLIC_WHATSAPP_SUPPORT_URL when settings have no URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_WHATSAPP_SUPPORT_URL", "https://env.example/support");
    setup({
      tables: { withdrawals: { data: pending }, company_settings: { data: { whatsapp_support_url: null } } },
    });
    await resolveWithdrawal("w1", "REJECTED", "r");
    expect(rejectedMock).toHaveBeenCalledWith(expect.objectContaining({ supportUrl: "https://env.example/support" }));
    vi.unstubAllEnvs();
  });

  it("falls back to an empty support URL when neither settings nor env provide one", async () => {
    vi.stubEnv("NEXT_PUBLIC_WHATSAPP_SUPPORT_URL", "");
    setup({ tables: { withdrawals: { data: pending }, company_settings: { data: null } } });
    await resolveWithdrawal("w1", "REJECTED", "r");
    expect(rejectedMock).toHaveBeenCalledWith(expect.objectContaining({ supportUrl: "" }));
    vi.unstubAllEnvs();
  });

  it("sends no email when the profile has no email, but still succeeds", async () => {
    setup({ tables: { withdrawals: { data: { ...pending, profiles: null } } } });
    await expect(resolveWithdrawal("w1", "COMPLETED")).resolves.toEqual({ success: true });
    expect(approvedMock).not.toHaveBeenCalled();
    expect(rejectedMock).not.toHaveBeenCalled();
  });

  it("still checks the low-balance threshold on a rejection refund even when the profile has no email", async () => {
    setup({ tables: { withdrawals: { data: { ...pending, profiles: null } } } });
    await resolveWithdrawal("w1", "REJECTED");
    expect(notifyIfLowBalanceMock).toHaveBeenCalledWith("owner-1");
  });

  it("sends no email for other non-pending statuses (e.g. PROCESSING)", async () => {
    setup({ tables: { withdrawals: { data: pending } } });
    await expect(resolveWithdrawal("w1", "PROCESSING" as never)).resolves.toEqual({ success: true });
    expect(approvedMock).not.toHaveBeenCalled();
    expect(rejectedMock).not.toHaveBeenCalled();
  });

  it("returns the RPC error without emailing or revalidating", async () => {
    const { client } = setup({ tables: { withdrawals: { data: pending } } });
    client.rpc.mockResolvedValue({ data: null, error: { message: "rpc failed" } });
    await expect(resolveWithdrawal("w1", "COMPLETED")).resolves.toEqual({ error: "rpc failed" });
    expect(approvedMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("converts thrown exceptions into the friendly message and logs them", async () => {
    const boom = new Error("boom");
    createClientMock.mockRejectedValue(boom);
    await expect(resolveWithdrawal("w1", "COMPLETED")).resolves.toEqual(UNEXPECTED);
    expect(logErrorMock).toHaveBeenCalledWith("action:withdrawals.resolve", boom);
  });
});
