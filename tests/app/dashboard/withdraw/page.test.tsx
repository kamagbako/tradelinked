import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import WithdrawPage, { generateMetadata } from "@/app/dashboard/withdraw/page";
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
vi.mock("@/components/dashboard/WithdrawalForm", () => ({ WithdrawalForm: () => <div data-testid="withdrawal-form" /> }));

beforeEach(() => {
  locale.current = "en";
});

const withdrawal = (over: Record<string, unknown> = {}) => ({
  id: "w1",
  user_id: "user-1",
  amount: 100,
  payout_method: "BANK_TRANSFER",
  payout_details: "IBAN GB00 0000",
  status: "PENDING",
  rejection_reason: null,
  created_at: "2025-01-15T12:00:00Z",
  ...over,
});

async function renderPage(data: unknown[] | null = []) {
  const mock = createSupabaseMock({ tables: { withdrawals: { data } } });
  vi.mocked(requireUser).mockResolvedValue({
    supabase: mock.client,
    user: { id: "user-1", email: "user@example.com" },
  } as unknown as Awaited<ReturnType<typeof requireUser>>);

  const ui = await WithdrawPage();
  render(
    <NextIntlClientProvider locale={locale.current} messages={loadMessages(locale.current)} timeZone="UTC">
      {ui}
    </NextIntlClientProvider>,
  );
  return mock;
}

const bodyRows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);

describe("withdraw page", () => {
  it("sets the page title", async () => {
    expect(await generateMetadata()).toEqual({ title: "Withdraw" });
  });

  it("propagates the redirect for signed-out users", async () => {
    vi.mocked(requireUser).mockRejectedValue(new RedirectSignal("/login/mfa"));
    await expect(WithdrawPage()).rejects.toMatchObject({ digest: expect.stringContaining("/login/mfa") });
  });

  it("renders the heading, the request form and the history heading", async () => {
    await renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Withdraw" })).toBeInTheDocument();
    expect(screen.getByTestId("withdrawal-form")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your withdrawals" })).toBeInTheDocument();
  });

  it("shows the empty state when there are no withdrawals", async () => {
    await renderPage([]);
    expect(screen.getByText("You haven't requested any withdrawals yet.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("treats a null result as empty", async () => {
    await renderPage(null);
    expect(screen.getByText("You haven't requested any withdrawals yet.")).toBeInTheDocument();
  });

  it("renders amount, method, status and payout details for each request", async () => {
    await renderPage([withdrawal({ amount: "80.5", payout_method: "BTC", status: "COMPLETED", payout_details: "bc1qabc" })]);
    const cells = within(bodyRows()[0]).getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("$80.50");
    expect(cells[1]).toHaveTextContent("Bitcoin (BTC)");
    expect(cells[2]).toHaveTextContent("COMPLETED");
    expect(cells[3]).toHaveTextContent("bc1qabc");
    expect(cells[4]).toHaveTextContent(/Jan 15, 2025/);
  });

  it("shows the rejection reason instead of payout details for rejected requests", async () => {
    await renderPage([
      withdrawal({ status: "REJECTED", payout_details: "secret-wallet", rejection_reason: "Insufficient funds" }),
    ]);
    const row = bodyRows()[0];
    expect(row).toHaveTextContent("Insufficient funds");
    expect(row).not.toHaveTextContent("secret-wallet");
  });

  it("shows a dash when a rejected request has no reason recorded", async () => {
    await renderPage([withdrawal({ status: "REJECTED", rejection_reason: null })]);
    expect(within(bodyRows()[0]).getAllByRole("cell")[3]).toHaveTextContent("—");
  });

  it("keeps the newest-first order and asks for the latest 50 of this user", async () => {
    const { builders } = await renderPage([withdrawal({ id: "a", amount: 3 }), withdrawal({ id: "b", amount: 2 })]);
    expect(bodyRows().map((r) => within(r).getAllByRole("cell")[0].textContent)).toEqual(["$3.00", "$2.00"]);
    expect(builders.withdrawals.calls).toContainEqual({ method: "eq", args: ["user_id", "user-1"] });
    expect(builders.withdrawals.calls).toContainEqual({ method: "order", args: ["created_at", { ascending: false }] });
    expect(builders.withdrawals.calls).toContainEqual({ method: "limit", args: [50] });
  });

  it("renders French copy", async () => {
    locale.current = "fr";
    await renderPage([]);
    expect(screen.getByRole("heading", { level: 1, name: "Retrait" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vos retraits" })).toBeInTheDocument();
    expect(screen.getByText("Vous n’avez encore demandé aucun retrait.")).toBeInTheDocument();
    expect(await generateMetadata()).toEqual({ title: "Retrait" });
  });

  it("renders Chinese copy", async () => {
    locale.current = "zh";
    await renderPage([withdrawal({ status: "PENDING" })]);
    expect(screen.getByRole("heading", { level: 1, name: "提款" })).toBeInTheDocument();
    expect(within(bodyRows()[0]).getAllByRole("cell")[2]).toHaveTextContent("待处理");
  });
});
