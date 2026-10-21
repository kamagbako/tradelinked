import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type SupabaseMockOptions } from "@tests/helpers/supabase";

const { createClientMock, revalidatePathMock, logErrorMock, notifyIfLowBalanceMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  logErrorMock: vi.fn(),
  notifyIfLowBalanceMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/lib/logger", () => ({ logError: logErrorMock, logWarn: vi.fn() }));
vi.mock("next-intl/server", async () => (await import("@tests/helpers/utils")).nextIntlServerMock());
vi.mock("@/lib/balance-alerts", () => ({ notifyIfLowBalance: notifyIfLowBalanceMock }));

import { applyLedgerEntry } from "@/lib/actions/ledger";

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

const valid = { userId: "target-1", type: "CREDIT", amount: "75.25", note: "  bonus " };

describe("applyLedgerEntry", () => {
  beforeEach(() => {
    setup({ user: { id: "admin-1" } });
  });

  it("requires a user and an entry type", async () => {
    const message = { error: "Select a user and entry type." };
    await expect(applyLedgerEntry(form({ ...valid, userId: "" }))).resolves.toEqual(message);
    await expect(applyLedgerEntry(form({ ...valid, type: "" }))).resolves.toEqual(message);
    await expect(applyLedgerEntry(form({ amount: "5" }))).resolves.toEqual(message);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("requires a positive numeric amount", async () => {
    const message = { error: "Enter a valid amount." };
    await expect(applyLedgerEntry(form({ ...valid, amount: "" }))).resolves.toEqual(message);
    await expect(applyLedgerEntry(form({ ...valid, amount: "0" }))).resolves.toEqual(message);
    await expect(applyLedgerEntry(form({ ...valid, amount: "-3" }))).resolves.toEqual(message);
    await expect(applyLedgerEntry(form({ ...valid, amount: "abc" }))).resolves.toEqual(message);
  });

  it("checks user/type before amount", async () => {
    await expect(applyLedgerEntry(form({ userId: "", type: "", amount: "0" }))).resolves.toEqual({
      error: "Select a user and entry type.",
    });
  });

  it("calls apply_ledger_entry with the parsed values and the acting admin id", async () => {
    const { client } = setup({ user: { id: "admin-7" } });
    await expect(applyLedgerEntry(form(valid))).resolves.toEqual({ success: true });
    expect(client.rpc).toHaveBeenCalledWith("apply_ledger_entry", {
      p_user_id: "target-1",
      p_type: "CREDIT",
      p_amount: 75.25,
      p_note: "bonus",
      p_created_by: "admin-7",
    });
  });

  it("stores a blank note as null", async () => {
    const { client } = setup();
    await applyLedgerEntry(form({ ...valid, note: "   " }));
    expect(client.rpc).toHaveBeenCalledWith("apply_ledger_entry", expect.objectContaining({ p_note: null }));
  });

  it("passes null as creator when there is no acting user", async () => {
    const { client } = setup({ user: null });
    await applyLedgerEntry(form(valid));
    expect(client.rpc).toHaveBeenCalledWith("apply_ledger_entry", expect.objectContaining({ p_created_by: null }));
  });

  it("checks the target user's balance against the low-balance threshold", async () => {
    await applyLedgerEntry(form(valid));
    expect(notifyIfLowBalanceMock).toHaveBeenCalledWith("target-1");
  });

  it("does not check the balance when the RPC fails", async () => {
    const { client } = setup();
    client.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await applyLedgerEntry(form(valid));
    expect(notifyIfLowBalanceMock).not.toHaveBeenCalled();
  });

  it("revalidates the admin ledger and dashboard", async () => {
    await applyLedgerEntry(form(valid));
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/ledger");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard");
  });

  it("returns the RPC error and does not revalidate", async () => {
    const { client } = setup();
    client.rpc.mockResolvedValue({ data: null, error: { message: "Insufficient balance" } });
    await expect(applyLedgerEntry(form({ ...valid, type: "DEBIT" }))).resolves.toEqual({ error: "Insufficient balance" });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("converts thrown exceptions into the friendly message and logs them", async () => {
    const boom = new Error("boom");
    createClientMock.mockRejectedValue(boom);
    await expect(applyLedgerEntry(form(valid))).resolves.toEqual({ error: "Something went wrong. Please try again." });
    expect(logErrorMock).toHaveBeenCalledWith("action:ledger.apply", boom);
  });
});
