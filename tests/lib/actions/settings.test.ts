import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type SupabaseMockOptions } from "@tests/helpers/supabase";

const { createClientMock, revalidatePathMock, logErrorMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  logErrorMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/lib/logger", () => ({ logError: logErrorMock, logWarn: vi.fn() }));
vi.mock("next-intl/server", async () => (await import("@tests/helpers/utils")).nextIntlServerMock());

import { toggleUserFreeze, updateCompanySettings } from "@/lib/actions/settings";

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

describe("updateCompanySettings", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-03-04T05:06:07.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("updates row id 1 with trimmed values and an updated_at timestamp", async () => {
    const { builders } = setup();
    const result = await updateCompanySettings(
      form({
        bankName: " First Bank ",
        bankAccountName: "TradeLinked Ltd",
        bankAccountNumber: " 0123456789 ",
        btcAddress: " bc1qabc ",
        usdtAddress: "TXyz",
        whatsappSupportUrl: " https://wa.me/1 ",
        depositFeePercent: "2.5",
        depositFeeFlat: "10",
        depositMinUsd: "50",
        depositMaxUsd: "10000",
        lowBalanceThresholdUsd: "250",
      }),
    );
    expect(result).toEqual({ success: true });
    expect(builders.company_settings.update).toHaveBeenCalledWith({
      bank_name: "First Bank",
      bank_account_name: "TradeLinked Ltd",
      bank_account_number: "0123456789",
      btc_address: "bc1qabc",
      usdt_address: "TXyz",
      whatsapp_support_url: "https://wa.me/1",
      deposit_fee_percent: 2.5,
      deposit_fee_flat: 10,
      deposit_min_usd: 50,
      deposit_max_usd: 10000,
      low_balance_threshold_usd: 250,
      updated_at: "2025-03-04T05:06:07.000Z",
    });
    expect(builders.company_settings.eq).toHaveBeenCalledWith("id", 1);
  });

  it("stores blank or missing text fields as null, and blank/missing numbers as 0 (clearing a setting)", async () => {
    const { builders } = setup();
    await updateCompanySettings(form({ bankName: "   " }));
    expect(builders.company_settings.update).toHaveBeenCalledWith({
      bank_name: null,
      bank_account_name: null,
      bank_account_number: null,
      btc_address: null,
      usdt_address: null,
      whatsapp_support_url: null,
      deposit_fee_percent: 0,
      deposit_fee_flat: 0,
      deposit_min_usd: 0,
      deposit_max_usd: 0,
      low_balance_threshold_usd: 0,
      updated_at: "2025-03-04T05:06:07.000Z",
    });
  });

  describe("deposit fee and limit validation", () => {
    it.each([
      ["depositFeePercent", "Deposit fee percentage must be a number of 0 or more."],
      ["depositFeeFlat", "Deposit flat fee must be a number of 0 or more."],
      ["depositMinUsd", "Minimum deposit must be a number of 0 or more."],
      ["depositMaxUsd", "Maximum deposit must be a number of 0 or more."],
      ["lowBalanceThresholdUsd", "Low balance alert threshold must be a number of 0 or more."],
    ])("rejects a negative %s", async (field, message) => {
      setup();
      await expect(updateCompanySettings(form({ [field]: "-1" }))).resolves.toEqual({ error: message });
    });

    it.each(["depositFeePercent", "depositFeeFlat", "depositMinUsd", "depositMaxUsd", "lowBalanceThresholdUsd"])(
      "rejects a non-numeric %s",
      async (field) => {
        setup();
        const result = await updateCompanySettings(form({ [field]: "abc" }));
        expect(result.error).toMatch(/must be a number of 0 or more\.$/);
      },
    );

    it("rejects a fee percentage over 100", async () => {
      setup();
      await expect(updateCompanySettings(form({ depositFeePercent: "150" }))).resolves.toEqual({
        error: "Deposit fee percentage can't be more than 100.",
      });
    });

    it("accepts a fee percentage of exactly 100", async () => {
      const { builders } = setup();
      await expect(updateCompanySettings(form({ depositFeePercent: "100" }))).resolves.toEqual({ success: true });
      expect(builders.company_settings.update).toHaveBeenCalledWith(expect.objectContaining({ deposit_fee_percent: 100 }));
    });

    it("rejects a maximum deposit below the minimum", async () => {
      setup();
      await expect(
        updateCompanySettings(form({ depositMinUsd: "500", depositMaxUsd: "100" })),
      ).resolves.toEqual({ error: "Maximum deposit can't be less than the minimum deposit." });
    });

    it("allows a maximum equal to the minimum", async () => {
      const { builders } = setup();
      await expect(
        updateCompanySettings(form({ depositMinUsd: "100", depositMaxUsd: "100" })),
      ).resolves.toEqual({ success: true });
      expect(builders.company_settings.update).toHaveBeenCalledWith(
        expect.objectContaining({ deposit_min_usd: 100, deposit_max_usd: 100 }),
      );
    });

    it("does not enforce min <= max when max is left blank (0, meaning unset)", async () => {
      const { builders } = setup();
      await expect(updateCompanySettings(form({ depositMinUsd: "500" }))).resolves.toEqual({ success: true });
      expect(builders.company_settings.update).toHaveBeenCalledWith(
        expect.objectContaining({ deposit_min_usd: 500, deposit_max_usd: 0 }),
      );
    });

    it("does not write to the database when validation fails", async () => {
      const { client } = setup();
      await updateCompanySettings(form({ depositFeePercent: "-1" }));
      expect(client.from).not.toHaveBeenCalled();
    });
  });

  it("revalidates the admin settings page and the deposit page", async () => {
    setup();
    await updateCompanySettings(form({}));
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/settings");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/deposit");
  });

  it("returns the database error and does not revalidate", async () => {
    setup({ tables: { company_settings: { error: { message: "permission denied" } } } });
    await expect(updateCompanySettings(form({}))).resolves.toEqual({ error: "permission denied" });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("converts thrown exceptions into the friendly message and logs them", async () => {
    const boom = new Error("boom");
    createClientMock.mockRejectedValue(boom);
    await expect(updateCompanySettings(form({}))).resolves.toEqual(UNEXPECTED);
    expect(logErrorMock).toHaveBeenCalledWith("action:settings.update", boom);
  });
});

describe("toggleUserFreeze", () => {
  it.each([true, false])("sets is_frozen=%s for the given user and revalidates", async (frozen) => {
    const { builders } = setup();
    await expect(toggleUserFreeze("user-5", frozen)).resolves.toEqual({ success: true });
    expect(builders.profiles.update).toHaveBeenCalledWith({ is_frozen: frozen });
    expect(builders.profiles.eq).toHaveBeenCalledWith("id", "user-5");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/users");
  });

  it("returns the database error and does not revalidate", async () => {
    setup({ tables: { profiles: { error: { message: "cannot freeze" } } } });
    await expect(toggleUserFreeze("u", true)).resolves.toEqual({ error: "cannot freeze" });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("converts thrown exceptions into the friendly message and logs them", async () => {
    const boom = new Error("boom");
    createClientMock.mockRejectedValue(boom);
    await expect(toggleUserFreeze("u", true)).resolves.toEqual(UNEXPECTED);
    expect(logErrorMock).toHaveBeenCalledWith("action:settings.toggleFreeze", boom);
  });
});
