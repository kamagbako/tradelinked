import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import TransactionsPage, { generateMetadata } from "@/app/dashboard/transactions/page";
import { requireUser } from "@/lib/auth/guard";
import { loadMessages } from "@tests/helpers/messages";
import { RedirectSignal, createSupabaseMock } from "@tests/helpers/supabase";

const locale = vi.hoisted(() => ({ current: "en" }));
const tableProps = vi.hoisted(() => ({ last: null as null | Record<string, unknown> }));

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { loadMessages } = await import("@tests/helpers/messages");
  return {
    getTranslations: async (namespace?: string) =>
      createTranslator({ locale: locale.current, messages: loadMessages(locale.current), namespace: namespace as never }),
  };
});
vi.mock("@/lib/auth/guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/components/dashboard/TransactionsTable", () => ({
  TransactionsTable: (props: Record<string, unknown>) => {
    tableProps.last = props;
    return <div data-testid="transactions-table" />;
  },
}));

beforeEach(() => {
  locale.current = "en";
  tableProps.last = null;
});

async function renderPage(tables: { deposits?: unknown[] | null; withdrawals?: unknown[] | null; ledger_entries?: unknown[] | null } = {}) {
  const mock = createSupabaseMock({
    tables: {
      deposits: { data: tables.deposits === undefined ? [] : tables.deposits },
      withdrawals: { data: tables.withdrawals === undefined ? [] : tables.withdrawals },
      ledger_entries: { data: tables.ledger_entries === undefined ? [] : tables.ledger_entries },
    },
  });
  vi.mocked(requireUser).mockResolvedValue({
    supabase: mock.client,
    user: { id: "user-1", email: "user@example.com" },
  } as unknown as Awaited<ReturnType<typeof requireUser>>);

  const ui = await TransactionsPage();
  render(
    <NextIntlClientProvider locale={locale.current} messages={loadMessages(locale.current)} timeZone="UTC">
      {ui}
    </NextIntlClientProvider>,
  );
  return mock;
}

describe("transactions page", () => {
  it("sets the page title", async () => {
    expect(await generateMetadata()).toEqual({ title: "Transactions" });
  });

  it("propagates the redirect for signed-out users", async () => {
    vi.mocked(requireUser).mockRejectedValue(new RedirectSignal("/login"));
    await expect(TransactionsPage()).rejects.toMatchObject({ digest: expect.stringContaining("/login") });
  });

  it("renders the heading and the table", async () => {
    await renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Transactions" })).toBeInTheDocument();
    expect(screen.getByTestId("transactions-table")).toBeInTheDocument();
  });

  it("passes the user id and the three result sets to the table", async () => {
    const deposits = [{ id: "d1" }];
    const withdrawals = [{ id: "w1" }, { id: "w2" }];
    const ledger = [{ id: "l1" }];
    await renderPage({ deposits, withdrawals, ledger_entries: ledger });
    expect(tableProps.last).toEqual({ userId: "user-1", deposits, withdrawals, ledger });
  });

  it("falls back to empty arrays when a query returns null", async () => {
    await renderPage({ deposits: null, withdrawals: null, ledger_entries: null });
    expect(tableProps.last).toEqual({ userId: "user-1", deposits: [], withdrawals: [], ledger: [] });
  });

  it("queries deposits, withdrawals and ledger entries: this user, newest first, latest 100", async () => {
    const { builders } = await renderPage();
    expect(Object.keys(builders).sort()).toEqual(["deposits", "ledger_entries", "withdrawals"]);
    for (const table of ["deposits", "withdrawals", "ledger_entries"]) {
      const calls = builders[table].calls;
      expect(calls).toContainEqual({ method: "select", args: ["*"] });
      expect(calls).toContainEqual({ method: "eq", args: ["user_id", "user-1"] });
      expect(calls).toContainEqual({ method: "order", args: ["created_at", { ascending: false }] });
      expect(calls).toContainEqual({ method: "limit", args: [100] });
    }
  });

  it("renders localised headings", async () => {
    locale.current = "zh";
    await renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "交易记录" })).toBeInTheDocument();
    expect(await generateMetadata()).toEqual({ title: "交易记录" });
  });

  it("renders the French heading", async () => {
    locale.current = "fr";
    await renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Transactions" })).toBeInTheDocument();
  });
});
