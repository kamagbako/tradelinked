import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { updateCompanySettings } from "@/lib/actions/settings";
import type { CompanySettings } from "@/lib/types";

vi.mock("@/lib/actions/settings", () => ({ updateCompanySettings: vi.fn() }));

const update = vi.mocked(updateCompanySettings);

const SETTINGS: CompanySettings = {
  id: 1,
  bank_name: "First Bank",
  bank_account_name: "TradeLinked Ltd",
  bank_account_number: "0123456789",
  btc_address: "bc1qexample",
  usdt_address: "TXexample",
  whatsapp_support_url: "https://wa.me/15550001111",
  deposit_fee_percent: 2.5,
  deposit_fee_flat: 5,
  deposit_min_usd: 50,
  deposit_max_usd: 10000,
  low_balance_threshold_usd: 100,
  updated_at: "2026-01-01T00:00:00Z",
};

const FIELDS: [label: string, name: string, key: keyof CompanySettings][] = [
  ["BTC receiving address", "btcAddress", "btc_address"],
  ["Processing fee (%)", "depositFeePercent", "deposit_fee_percent"],
  ["Processing fee, flat ($)", "depositFeeFlat", "deposit_fee_flat"],
  ["Minimum deposit ($)", "depositMinUsd", "deposit_min_usd"],
  ["Maximum deposit ($)", "depositMaxUsd", "deposit_max_usd"],
  ["Alert threshold ($)", "lowBalanceThresholdUsd", "low_balance_threshold_usd"],
  ["Bank name", "bankName", "bank_name"],
  ["Account name", "bankAccountName", "bank_account_name"],
  ["Account number", "bankAccountNumber", "bank_account_number"],
  ["USDT (TRC20) address", "usdtAddress", "usdt_address"],
  ["WhatsApp support link", "whatsappSupportUrl", "whatsapp_support_url"],
];

const save = () => screen.getByRole("button", { name: "Save Settings" });

beforeEach(() => {
  update.mockResolvedValue({ success: true });
});

describe("SettingsForm keeps edits on error", () => {
  it("does not revert typed values when saving fails", async () => {
    update.mockResolvedValue({ error: "permission denied" });
    const user = userEvent.setup();
    render(<SettingsForm settings={SETTINGS} />);
    const bank = screen.getByLabelText("Bank name");
    await user.clear(bank);
    await user.type(bank, "Second Bank");
    await user.click(save());

    expect(await screen.findByText("permission denied")).toBeInTheDocument();
    expect(screen.getByLabelText("Bank name")).toHaveValue("Second Bank");
  });
});

describe("SettingsForm", () => {
  it("renders the heading and every field", () => {
    render(<SettingsForm settings={SETTINGS} />);
    expect(screen.getByRole("heading", { name: "Company Payout Details" })).toBeInTheDocument();
    for (const [label, name] of FIELDS) {
      expect(screen.getByLabelText(label)).toHaveAttribute("name", name);
    }
  });

  it.each(FIELDS)("prefills %s from the saved settings", (label, _name, key) => {
    render(<SettingsForm settings={SETTINGS} />);
    expect(screen.getByLabelText(label)).toHaveValue(SETTINGS[key]);
  });

  it("renders empty fields when nothing has been saved yet", () => {
    render(<SettingsForm settings={null} />);
    for (const [label, name] of FIELDS) {
      // jest-dom reports an empty <input type="number"> as null, and an empty text input as "".
      const isNumberField = name.startsWith("deposit") || name === "lowBalanceThresholdUsd";
      expect(screen.getByLabelText(label)).toHaveValue(isNumberField ? null : "");
    }
  });

  it("renders empty fields for null columns", () => {
    render(<SettingsForm settings={{ ...SETTINGS, btc_address: null, whatsapp_support_url: null }} />);
    expect(screen.getByLabelText("BTC receiving address")).toHaveValue("");
    expect(screen.getByLabelText("WhatsApp support link")).toHaveValue("");
    expect(screen.getByLabelText("Bank name")).toHaveValue("First Bank");
  });

  it("validates the WhatsApp link as a url and shows a placeholder", () => {
    render(<SettingsForm settings={null} />);
    const input = screen.getByLabelText("WhatsApp support link");
    expect(input).toHaveAttribute("type", "url");
    expect(input).toHaveAttribute("placeholder", "https://wa.me/10000000000");
  });

  it("does not show a status message initially", () => {
    render(<SettingsForm settings={SETTINGS} />);
    expect(screen.queryByText("Settings saved.")).not.toBeInTheDocument();
  });

  it("posts every field as FormData", async () => {
    const user = userEvent.setup();
    render(<SettingsForm settings={SETTINGS} />);
    await user.click(save());

    expect(update).toHaveBeenCalledTimes(1);
    expect(Object.fromEntries(update.mock.calls[0][0].entries())).toEqual({
      bankName: "First Bank",
      bankAccountName: "TradeLinked Ltd",
      bankAccountNumber: "0123456789",
      btcAddress: "bc1qexample",
      usdtAddress: "TXexample",
      whatsappSupportUrl: "https://wa.me/15550001111",
      depositFeePercent: "2.5",
      depositFeeFlat: "5",
      depositMinUsd: "50",
      depositMaxUsd: "10000",
      lowBalanceThresholdUsd: "100",
    });
  });

  it("posts edited values", async () => {
    const user = userEvent.setup();
    render(<SettingsForm settings={null} />);
    await user.type(screen.getByLabelText("Bank name"), "New Bank");
    await user.type(screen.getByLabelText("BTC receiving address"), "bc1qnew");
    await user.type(screen.getByLabelText("WhatsApp support link"), "https://wa.me/1");
    await user.click(save());

    const data = Object.fromEntries(update.mock.calls[0][0].entries());
    expect(data).toMatchObject({ bankName: "New Bank", btcAddress: "bc1qnew", whatsappSupportUrl: "https://wa.me/1", usdtAddress: "" });
  });

  it("posts the fee and limit fields blank when unconfigured", async () => {
    const user = userEvent.setup();
    render(<SettingsForm settings={null} />);
    await user.click(save());

    const data = Object.fromEntries(update.mock.calls[0][0].entries());
    expect(data).toMatchObject({
      depositFeePercent: "",
      depositFeeFlat: "",
      depositMinUsd: "",
      depositMaxUsd: "",
    });
  });

  it("notes that bank/USDT are currently unused and marks Bitcoin fields as such", () => {
    render(<SettingsForm settings={SETTINGS} />);
    expect(screen.getByText("Bitcoin deposits")).toBeInTheDocument();
    expect(screen.getByText(/Deposits currently only accept Bitcoin/)).toBeInTheDocument();
    expect(screen.getByText("Bank & USDT details")).toBeInTheDocument();
    expect(screen.getByText(/Not currently used/)).toBeInTheDocument();
  });

  it("does not submit an invalid WhatsApp URL", async () => {
    const user = userEvent.setup();
    render(<SettingsForm settings={null} />);
    await user.type(screen.getByLabelText("WhatsApp support link"), "not a url");
    await user.click(save());
    expect(update).not.toHaveBeenCalled();
  });

  it("shows a success message after saving", async () => {
    const user = userEvent.setup();
    render(<SettingsForm settings={SETTINGS} />);
    await user.click(save());
    expect(await screen.findByText("Settings saved.")).toHaveClass("text-emerald-400");
  });

  it("shows the error message returned by the action", async () => {
    update.mockResolvedValue({ error: "Forbidden" });
    const user = userEvent.setup();
    render(<SettingsForm settings={SETTINGS} />);
    await user.click(save());

    expect(await screen.findByText("Forbidden")).toHaveClass("text-red-400");
    expect(screen.queryByText("Settings saved.")).not.toBeInTheDocument();
  });

  it("disables the button with a spinner while saving", async () => {
    let finish!: (v: { success: boolean }) => void;
    update.mockReturnValue(new Promise((r) => (finish = r)));
    const user = userEvent.setup();
    const { container } = render(<SettingsForm settings={SETTINGS} />);
    await user.click(save());

    await waitFor(() => expect(save()).toBeDisabled());
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();

    await act(async () => finish({ success: true }));
    await waitFor(() => expect(save()).toBeEnabled());
  });
});
