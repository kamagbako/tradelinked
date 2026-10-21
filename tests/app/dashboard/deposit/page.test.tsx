import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import DepositPage, { generateMetadata } from "@/app/dashboard/deposit/page";
import { requireUser } from "@/lib/auth/guard";
import { loadMessages } from "@tests/helpers/messages";
import { RedirectSignal, createSupabaseMock } from "@tests/helpers/supabase";

const locale = vi.hoisted(() => ({ current: "en" }));

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { loadMessages } = await import("@tests/helpers/messages");
  return {
    getTranslations: async (namespace?: string) =>
      createTranslator({ locale: locale.current, messages: loadMessages(locale.current), namespace: namespace as never }),
  };
});
vi.mock("@/lib/auth/guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/components/dashboard/DepositForm", () => ({
  DepositForm: (props: {
    btcAddress: string | null;
    qrDataUrl?: string | null;
    feePercent: number;
    feeFlat: number;
    minUsd: number;
    maxUsd: number;
    initialAmount?: number | null;
  }) => (
    <div
      data-testid="deposit-form"
      data-address={props.btcAddress ?? ""}
      data-qr={props.qrDataUrl ?? ""}
      data-fee-percent={props.feePercent}
      data-fee-flat={props.feeFlat}
      data-min={props.minUsd}
      data-max={props.maxUsd}
      data-initial-amount={props.initialAmount ?? ""}
    />
  ),
}));

const qrToDataURL = vi.hoisted(() => vi.fn(async () => "data:image/png;base64,FAKE_QR"));
vi.mock("qrcode", () => ({ default: { toDataURL: qrToDataURL } }));

const logError = vi.fn();
vi.mock("@/lib/logger", () => ({ logError: (...a: unknown[]) => logError(...a), logWarn: vi.fn() }));

beforeEach(() => {
  locale.current = "en";
  qrToDataURL.mockClear();
  qrToDataURL.mockResolvedValue("data:image/png;base64,FAKE_QR");
  logError.mockClear();
});

const fullSettings = {
  id: 1,
  btc_address: "bc1qexample",
  deposit_fee_percent: 2.5,
  deposit_fee_flat: 5,
  deposit_min_usd: 50,
  deposit_max_usd: 10000,
};

const deposit = (over: Record<string, unknown> = {}) => ({
  id: "d1",
  user_id: "user-1",
  amount: 100,
  method: "BTC",
  reference: "0xhash",
  status: "PENDING",
  rejection_reason: null,
  created_at: "2025-01-15T12:00:00Z",
  ...over,
});

async function renderPage(
  data: {
    settings?: Record<string, unknown> | null;
    deposits?: unknown[] | null;
    activePlan?: string | null;
    plan?: string;
  } = {},
) {
  const mock = createSupabaseMock({
    tables: {
      company_settings: { data: data.settings === undefined ? fullSettings : data.settings },
      deposits: { data: data.deposits === undefined ? [] : data.deposits },
      profiles: { data: { active_plan: data.activePlan ?? null } },
    },
  });
  vi.mocked(requireUser).mockResolvedValue({
    supabase: mock.client,
    user: { id: "user-1", email: "user@example.com" },
  } as unknown as Awaited<ReturnType<typeof requireUser>>);

  const ui = await DepositPage({ searchParams: Promise.resolve({ plan: data.plan }) });
  render(
    <NextIntlClientProvider locale={locale.current} messages={loadMessages(locale.current)} timeZone="UTC">
      {ui}
    </NextIntlClientProvider>,
  );
  return mock;
}

const form = () => screen.getByTestId("deposit-form");

describe("deposit page", () => {
  it("sets the page title", async () => {
    expect(await generateMetadata()).toEqual({ title: "Deposit" });
  });

  it("propagates the redirect for signed-out users", async () => {
    vi.mocked(requireUser).mockRejectedValue(new RedirectSignal("/login"));
    await expect(DepositPage({ searchParams: Promise.resolve({}) })).rejects.toMatchObject({
      digest: expect.stringContaining("/login"),
    });
  });

  it("renders the heading, the deposit form and the history section", async () => {
    await renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Deposit" })).toBeInTheDocument();
    expect(form()).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your deposits" })).toBeInTheDocument();
  });

  describe("passing settings to the deposit form", () => {
    it("passes the configured address, fee and limits through unchanged", async () => {
      await renderPage();
      expect(form()).toHaveAttribute("data-address", "bc1qexample");
      expect(form()).toHaveAttribute("data-fee-percent", "2.5");
      expect(form()).toHaveAttribute("data-fee-flat", "5");
      expect(form()).toHaveAttribute("data-min", "50");
      expect(form()).toHaveAttribute("data-max", "10000");
    });

    it("passes no address and zero fee when nothing is configured, with sensible default limits", async () => {
      await renderPage({ settings: { id: 1 } });
      expect(form()).toHaveAttribute("data-address", "");
      expect(form()).toHaveAttribute("data-fee-percent", "0");
      expect(form()).toHaveAttribute("data-fee-flat", "0");
      expect(form()).toHaveAttribute("data-min", "10");
      expect(form()).toHaveAttribute("data-max", "1000000");
    });

    it("falls back to the same defaults when the settings row is missing entirely", async () => {
      await renderPage({ settings: null });
      expect(form()).toHaveAttribute("data-address", "");
      expect(form()).toHaveAttribute("data-min", "10");
      expect(form()).toHaveAttribute("data-max", "1000000");
    });

    it("reads the singleton company_settings row", async () => {
      const { builders } = await renderPage();
      expect(builders.company_settings.calls).toContainEqual({ method: "eq", args: ["id", 1] });
    });
  });

  describe("QR code", () => {
    it("generates one for the configured address and passes it through", async () => {
      await renderPage();
      expect(qrToDataURL).toHaveBeenCalledExactlyOnceWith("bc1qexample", expect.objectContaining({ width: 384 }));
      expect(form()).toHaveAttribute("data-qr", "data:image/png;base64,FAKE_QR");
    });

    it("does not generate one when there is no address", async () => {
      await renderPage({ settings: { id: 1 } });
      expect(qrToDataURL).not.toHaveBeenCalled();
      expect(form()).toHaveAttribute("data-qr", "");
    });

    it("still renders the page, with no QR code, if generation throws", async () => {
      qrToDataURL.mockRejectedValueOnce(new Error("encoding failed"));
      await renderPage();
      expect(form()).toHaveAttribute("data-qr", "");
      expect(logError).toHaveBeenCalledWith("deposit.qrCode", expect.any(Error));
      expect(screen.getByRole("heading", { level: 1, name: "Deposit" })).toBeInTheDocument();
    });
  });

  describe("pre-filling the amount from a plan", () => {
    it("uses the ?plan= query param's minimum deposit", async () => {
      await renderPage({ plan: "growth" });
      expect(form()).toHaveAttribute("data-initial-amount", "5000");
    });

    it("falls back to the user's own active plan when there is no query param", async () => {
      await renderPage({ activePlan: "elite" });
      expect(form()).toHaveAttribute("data-initial-amount", "25000");
    });

    it("prefers the query param over the active plan when both are present", async () => {
      await renderPage({ plan: "starter", activePlan: "elite" });
      expect(form()).toHaveAttribute("data-initial-amount", "500");
    });

    it("passes nothing when neither is set", async () => {
      await renderPage();
      expect(form()).toHaveAttribute("data-initial-amount", "");
    });

    it("ignores an unknown plan id in the query param and falls back to the active plan", async () => {
      await renderPage({ plan: "not-a-real-plan", activePlan: "growth" });
      expect(form()).toHaveAttribute("data-initial-amount", "5000");
    });

    it("ignores an unrecognised active plan value", async () => {
      await renderPage({ activePlan: "Gold" });
      expect(form()).toHaveAttribute("data-initial-amount", "");
    });
  });

  describe("deposit history", () => {
    it("shows the empty state when there are no deposits", async () => {
      await renderPage({ deposits: [] });
      expect(screen.getByText("You haven't submitted any deposits yet.")).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("treats a null result as empty", async () => {
      await renderPage({ deposits: null });
      expect(screen.getByText("You haven't submitted any deposits yet.")).toBeInTheDocument();
    });

    it("renders each deposit with amount, method, status and the reference as detail", async () => {
      await renderPage({ deposits: [deposit({ amount: "250.5", method: "USDT", status: "APPROVED", reference: "hash-1" })] });
      const row = within(screen.getByRole("table")).getAllByRole("row")[1];
      const cells = within(row).getAllByRole("cell");
      expect(cells[0]).toHaveTextContent("$250.50");
      expect(cells[1]).toHaveTextContent("USDT");
      expect(cells[2]).toHaveTextContent("APPROVED");
      expect(cells[3]).toHaveTextContent("hash-1");
      expect(cells[4]).toHaveTextContent(/Jan 15, 2025/);
    });

    it("shows the rejection reason instead of the reference for rejected deposits", async () => {
      await renderPage({
        deposits: [deposit({ status: "REJECTED", reference: "ignored-ref", rejection_reason: "Funds never arrived" })],
      });
      const row = within(screen.getByRole("table")).getAllByRole("row")[1];
      expect(row).toHaveTextContent("Funds never arrived");
      expect(row).not.toHaveTextContent("ignored-ref");
    });

    it("shows a dash when a pending deposit has no reference", async () => {
      await renderPage({ deposits: [deposit({ reference: null })] });
      const row = within(screen.getByRole("table")).getAllByRole("row")[1];
      expect(within(row).getAllByRole("cell")[3]).toHaveTextContent("—");
    });

    it("keeps the query order (newest first) and asks for the latest 50 of this user", async () => {
      const { builders } = await renderPage({
        deposits: [deposit({ id: "new", amount: 2 }), deposit({ id: "old", amount: 1 })],
      });
      const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
      expect(rows.map((r) => within(r).getAllByRole("cell")[0].textContent)).toEqual(["$2.00", "$1.00"]);
      const calls = builders.deposits.calls;
      expect(calls).toContainEqual({ method: "eq", args: ["user_id", "user-1"] });
      expect(calls).toContainEqual({ method: "order", args: ["created_at", { ascending: false }] });
      expect(calls).toContainEqual({ method: "limit", args: [50] });
    });
  });

  describe("localisation", () => {
    it("renders the French heading and title", async () => {
      locale.current = "fr";
      await renderPage();
      expect(screen.getByRole("heading", { level: 1, name: "Dépôt" })).toBeInTheDocument();
      expect(await generateMetadata()).toEqual({ title: "Dépôt" });
    });

    it("renders the Chinese empty state", async () => {
      locale.current = "zh";
      await renderPage({ deposits: [] });
      expect(screen.getByRole("heading", { level: 1, name: "存款" })).toBeInTheDocument();
      expect(screen.getByText("您尚未提交任何存款。")).toBeInTheDocument();
    });
  });
});
