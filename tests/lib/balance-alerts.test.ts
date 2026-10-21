import { describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type SupabaseMockOptions } from "@tests/helpers/supabase";

const { createServiceClientMock, sendLowBalanceEmailMock, logErrorMock } = vi.hoisted(() => ({
  createServiceClientMock: vi.fn(),
  sendLowBalanceEmailMock: vi.fn(),
  logErrorMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: createServiceClientMock }));
vi.mock("@/lib/email/notifications", () => ({ sendLowBalanceEmail: sendLowBalanceEmailMock }));
vi.mock("@/lib/logger", () => ({ logError: logErrorMock }));

import { notifyIfLowBalance } from "@/lib/balance-alerts";

function setup(options: SupabaseMockOptions = {}) {
  const mock = createSupabaseMock(options);
  createServiceClientMock.mockReturnValue(mock.client);
  return mock;
}

const THRESHOLD_50 = { low_balance_threshold_usd: 50 };

describe("notifyIfLowBalance", () => {
  it("does nothing when no threshold is configured (0, the default)", async () => {
    setup({
      tables: {
        company_settings: { data: { low_balance_threshold_usd: 0 } },
        balances: { data: { available_balance: 1, low_balance_notified_at: null } },
      },
    });
    await notifyIfLowBalance("u1");
    expect(sendLowBalanceEmailMock).not.toHaveBeenCalled();
  });

  it("does nothing when there is no balance row for the user", async () => {
    setup({ tables: { company_settings: { data: THRESHOLD_50 }, balances: { data: null } } });
    await notifyIfLowBalance("u1");
    expect(sendLowBalanceEmailMock).not.toHaveBeenCalled();
  });

  it("emails the user and marks them notified when the balance dips below the threshold", async () => {
    const { builders } = setup({
      tables: {
        company_settings: { data: THRESHOLD_50 },
        balances: { data: { available_balance: 20, low_balance_notified_at: null } },
        profiles: { data: { email: "user@example.com" } },
      },
    });
    await notifyIfLowBalance("u1");
    expect(sendLowBalanceEmailMock).toHaveBeenCalledWith({ userEmail: "user@example.com", balance: 20, threshold: 50 });
    expect(builders.balances.update).toHaveBeenCalledWith({ low_balance_notified_at: expect.any(String) });
    expect(builders.balances.calls).toContainEqual({ method: "eq", args: ["user_id", "u1"] });
  });

  it("does not email again while already notified and still below the threshold", async () => {
    setup({
      tables: {
        company_settings: { data: THRESHOLD_50 },
        balances: { data: { available_balance: 10, low_balance_notified_at: "2025-01-01T00:00:00Z" } },
      },
    });
    await notifyIfLowBalance("u1");
    expect(sendLowBalanceEmailMock).not.toHaveBeenCalled();
  });

  it("does nothing when the balance is at or above the threshold and was never notified", async () => {
    const { builders } = setup({
      tables: {
        company_settings: { data: THRESHOLD_50 },
        balances: { data: { available_balance: 50, low_balance_notified_at: null } },
      },
    });
    await notifyIfLowBalance("u1");
    expect(sendLowBalanceEmailMock).not.toHaveBeenCalled();
    expect(builders.balances.update).not.toHaveBeenCalled();
  });

  it("clears the notified flag once the balance recovers to or above the threshold", async () => {
    const { builders } = setup({
      tables: {
        company_settings: { data: THRESHOLD_50 },
        balances: { data: { available_balance: 75, low_balance_notified_at: "2025-01-01T00:00:00Z" } },
      },
    });
    await notifyIfLowBalance("u1");
    expect(sendLowBalanceEmailMock).not.toHaveBeenCalled();
    expect(builders.balances.update).toHaveBeenCalledWith({ low_balance_notified_at: null });
    expect(builders.balances.calls).toContainEqual({ method: "eq", args: ["user_id", "u1"] });
  });

  it("still marks the user notified even when their profile has no email", async () => {
    const { builders } = setup({
      tables: {
        company_settings: { data: THRESHOLD_50 },
        balances: { data: { available_balance: 10, low_balance_notified_at: null } },
        profiles: { data: null },
      },
    });
    await notifyIfLowBalance("u1");
    expect(sendLowBalanceEmailMock).not.toHaveBeenCalled();
    expect(builders.balances.update).toHaveBeenCalledWith({ low_balance_notified_at: expect.any(String) });
  });

  it("coerces a numeric threshold/balance that comes back as a string", async () => {
    setup({
      tables: {
        company_settings: { data: { low_balance_threshold_usd: "50" } },
        balances: { data: { available_balance: "10", low_balance_notified_at: null } },
        profiles: { data: { email: "user@example.com" } },
      },
    });
    await notifyIfLowBalance("u1");
    expect(sendLowBalanceEmailMock).toHaveBeenCalledWith({ userEmail: "user@example.com", balance: 10, threshold: 50 });
  });

  it("uses the service-role client, not the request-scoped one", async () => {
    setup({ tables: { company_settings: { data: THRESHOLD_50 }, balances: { data: null } } });
    await notifyIfLowBalance("u1");
    expect(createServiceClientMock).toHaveBeenCalledTimes(1);
  });

  it("logs and swallows a thrown error instead of propagating it", async () => {
    const boom = new Error("connection reset");
    createServiceClientMock.mockImplementation(() => {
      throw boom;
    });
    await expect(notifyIfLowBalance("u1")).resolves.toBeUndefined();
    expect(logErrorMock).toHaveBeenCalledWith("balanceAlerts.notifyIfLowBalance", boom);
  });

  it("logs and swallows a database error from the email send path", async () => {
    setup({
      tables: {
        company_settings: { data: THRESHOLD_50 },
        balances: { data: { available_balance: 10, low_balance_notified_at: null } },
        profiles: { data: { email: "user@example.com" } },
      },
    });
    const boom = new Error("resend down");
    sendLowBalanceEmailMock.mockRejectedValueOnce(boom);
    await expect(notifyIfLowBalance("u1")).resolves.toBeUndefined();
    expect(logErrorMock).toHaveBeenCalledWith("balanceAlerts.notifyIfLowBalance", boom);
  });
});
