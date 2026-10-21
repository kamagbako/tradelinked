import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, within } from "@testing-library/react";
import { TransactionsTable } from "@/components/dashboard/TransactionsTable";
import type { Deposit, LedgerEntry, Withdrawal } from "@/lib/types";
import { renderWithIntl } from "@tests/helpers/utils";

const realtime = vi.hoisted(() => ({
  handler: null as null | ((payload: { new: unknown }) => void),
  config: null as unknown,
  channelName: "",
  removed: 0,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => {
    const channel: Record<string, unknown> = {};
    channel.on = (_type: string, config: unknown, handler: (payload: { new: unknown }) => void) => {
      realtime.config = config;
      realtime.handler = handler;
      return channel;
    };
    channel.subscribe = () => channel;
    return {
      channel: (name: string) => {
        realtime.channelName = name;
        return channel;
      },
      removeChannel: () => {
        realtime.removed += 1;
      },
    };
  },
}));

beforeEach(() => {
  realtime.handler = null;
  realtime.removed = 0;
});

const deposit = (over: Partial<Deposit> = {}): Deposit => ({
  id: "d1",
  user_id: "u1",
  amount: 500,
  method: "BTC",
  reference: null,
  status: "APPROVED",
  rejection_reason: null,
  created_at: "2025-01-10T12:00:00Z",
  resolved_at: null,
  ...over,
});

const withdrawal = (over: Partial<Withdrawal> = {}): Withdrawal => ({
  id: "w1",
  user_id: "u1",
  amount: 200,
  payout_method: "BANK_TRANSFER",
  payout_details: "acct",
  status: "PENDING",
  rejection_reason: null,
  created_at: "2025-01-12T12:00:00Z",
  resolved_at: null,
  resolved_by: null,
  ...over,
});

const ledgerEntry = (over: Partial<LedgerEntry> = {}): LedgerEntry => ({
  id: "l1",
  user_id: "u1",
  type: "PROFIT_YIELD",
  amount: 30,
  note: null,
  created_by: null,
  created_at: "2025-01-14T12:00:00Z",
  ...over,
});

function renderTable(
  props: { deposits?: Deposit[]; withdrawals?: Withdrawal[]; ledger?: LedgerEntry[] } = {},
  locale = "en",
) {
  return renderWithIntl(
    <TransactionsTable userId="u1" deposits={props.deposits ?? []} withdrawals={props.withdrawals ?? []} ledger={props.ledger ?? []} />,
    { locale },
  );
}

const bodyRows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);
const cellsOf = (row: HTMLElement) => within(row).getAllByRole("cell");
const amounts = () => bodyRows().map((r) => cellsOf(r)[0].textContent);
const labels = () => bodyRows().map((r) => cellsOf(r)[1].textContent);

describe("TransactionsTable", () => {
  describe("rows", () => {
    it("shows the empty state when there is nothing", () => {
      renderTable();
      expect(screen.getByText("No transactions yet.")).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("renders the column headers", () => {
      renderTable({ deposits: [deposit()] });
      expect(within(screen.getByRole("table")).getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
        "Amount",
        "Transaction",
        "Status",
        "Date",
      ]);
    });

    it("merges deposits, withdrawals and ledger entries, newest first", () => {
      renderTable({
        deposits: [deposit({ id: "d1", amount: 500, created_at: "2025-01-10T12:00:00Z" })],
        withdrawals: [withdrawal({ id: "w1", amount: 200, created_at: "2025-01-12T12:00:00Z" })],
        ledger: [ledgerEntry({ id: "l1", amount: 30, created_at: "2025-01-14T12:00:00Z" })],
      });
      expect(amounts()).toEqual(["+$30.00", "-$200.00", "+$500.00"]);
    });

    it("sorts across sources by timestamp, not by source", () => {
      renderTable({
        deposits: [
          deposit({ id: "d1", amount: 1, created_at: "2025-01-01T12:00:00Z" }),
          deposit({ id: "d2", amount: 4, created_at: "2025-01-04T12:00:00Z" }),
        ],
        withdrawals: [withdrawal({ id: "w1", amount: 3, created_at: "2025-01-03T12:00:00Z" })],
        ledger: [
          ledgerEntry({ id: "l1", amount: 2, created_at: "2025-01-02T12:00:00Z" }),
          ledgerEntry({ id: "l2", amount: 5, created_at: "2025-01-05T12:00:00Z" }),
        ],
      });
      expect(amounts()).toEqual(["+$5.00", "+$4.00", "-$3.00", "+$2.00", "+$1.00"]);
    });

    it("labels deposits and withdrawals with the translated method", () => {
      renderTable({
        deposits: [deposit({ method: "BTC", created_at: "2025-01-02T12:00:00Z" })],
        withdrawals: [withdrawal({ payout_method: "BANK_TRANSFER", created_at: "2025-01-01T12:00:00Z" })],
      });
      expect(labels()).toEqual(["Deposit · Bitcoin (BTC)", "Withdrawal · Bank Transfer"]);
    });

    it("labels ledger entries with their note when present, else the translated type", () => {
      renderTable({
        ledger: [
          ledgerEntry({ id: "l1", note: "Weekly profit", created_at: "2025-01-02T12:00:00Z" }),
          ledgerEntry({ id: "l2", note: null, type: "PROFIT_YIELD", created_at: "2025-01-01T12:00:00Z" }),
        ],
      });
      expect(labels()).toEqual(["Weekly profit", "PROFIT YIELD"]);
    });

    it("treats a blank ledger note as no note", () => {
      renderTable({ ledger: [ledgerEntry({ type: "CREDIT", note: "" })] });
      expect(labels()).toEqual(["CREDIT"]);
    });

    it("formats the date column", () => {
      renderTable({ deposits: [deposit({ created_at: "2025-03-09T12:00:00Z" })] });
      expect(cellsOf(bodyRows()[0])[3]).toHaveTextContent(/Mar 9, 2025/);
    });
  });

  describe("no double counting of approved deposits", () => {
    it("hides CREDIT ledger rows whose note starts with 'Deposit approved'", () => {
      renderTable({
        deposits: [deposit({ amount: 500 })],
        ledger: [
          ledgerEntry({ id: "l1", type: "CREDIT", amount: 500, note: "Deposit approved (BTC)" }),
          ledgerEntry({ id: "l2", type: "CREDIT", amount: 25, note: "Bonus", created_at: "2025-01-09T12:00:00Z" }),
        ],
      });
      expect(bodyRows()).toHaveLength(2);
      expect(amounts()).toEqual(["+$500.00", "+$25.00"]);
      expect(screen.queryByText(/Deposit approved/)).not.toBeInTheDocument();
    });

    it("keeps non-CREDIT entries even if their note starts with 'Deposit approved'", () => {
      renderTable({
        ledger: [ledgerEntry({ type: "DEBIT", amount: 10, note: "Deposit approved reversal" })],
      });
      expect(amounts()).toEqual(["-$10.00"]);
    });

    it("keeps CREDIT entries whose note merely contains the phrase later on", () => {
      renderTable({
        ledger: [ledgerEntry({ type: "CREDIT", amount: 10, note: "Manual: Deposit approved elsewhere" })],
      });
      expect(bodyRows()).toHaveLength(1);
    });

    it("shows the empty state when the only ledger entry is a hidden deposit credit", () => {
      renderTable({ ledger: [ledgerEntry({ type: "CREDIT", note: "Deposit approved" })] });
      expect(screen.getByText("No transactions yet.")).toBeInTheDocument();
    });
  });

  describe("signs, colours and badges", () => {
    it("shows deposits as green +, withdrawals as red -", () => {
      renderTable({
        deposits: [deposit({ amount: 10, created_at: "2025-01-02T12:00:00Z" })],
        withdrawals: [withdrawal({ amount: 20, created_at: "2025-01-01T12:00:00Z" })],
      });
      const [depositRow, withdrawalRow] = bodyRows();
      expect(within(depositRow).getByText("+$10.00")).toHaveClass("text-emerald-400");
      expect(within(withdrawalRow).getByText("-$20.00")).toHaveClass("text-red-400");
    });

    it("shows CREDIT and PROFIT_YIELD ledger entries as +, DEBIT as -", () => {
      renderTable({
        ledger: [
          ledgerEntry({ id: "a", type: "CREDIT", amount: 1, note: "c", created_at: "2025-01-03T12:00:00Z" }),
          ledgerEntry({ id: "b", type: "DEBIT", amount: 2, note: "d", created_at: "2025-01-02T12:00:00Z" }),
          ledgerEntry({ id: "c", type: "PROFIT_YIELD", amount: 3, note: "p", created_at: "2025-01-01T12:00:00Z" }),
        ],
      });
      expect(amounts()).toEqual(["+$1.00", "-$2.00", "+$3.00"]);
      const [credit, debit, profit] = bodyRows();
      expect(within(credit).getByText("+$1.00")).toHaveClass("text-emerald-400");
      expect(within(debit).getByText("-$2.00")).toHaveClass("text-red-400");
      expect(within(profit).getByText("+$3.00")).toHaveClass("text-emerald-400");
    });

    it.each([
      ["APPROVED", "text-emerald-400"],
      ["PENDING", "text-amber-400"],
      ["REJECTED", "text-red-400"],
    ] as const)("renders a %s deposit badge with the right tone", (status, toneClass) => {
      renderTable({ deposits: [deposit({ status })] });
      expect(within(bodyRows()[0]).getByText(status)).toHaveClass(toneClass);
    });

    it("renders a COMPLETED withdrawal badge as success", () => {
      renderTable({ withdrawals: [withdrawal({ status: "COMPLETED" })] });
      expect(within(bodyRows()[0]).getByText("COMPLETED")).toHaveClass("text-emerald-400");
    });

    it("renders ledger type badges: CREDIT success, DEBIT danger, PROFIT YIELD info", () => {
      renderTable({
        ledger: [
          ledgerEntry({ id: "a", type: "CREDIT", note: "x", created_at: "2025-01-03T12:00:00Z" }),
          ledgerEntry({ id: "b", type: "DEBIT", note: "y", created_at: "2025-01-02T12:00:00Z" }),
          ledgerEntry({ id: "c", type: "PROFIT_YIELD", note: "z", created_at: "2025-01-01T12:00:00Z" }),
        ],
      });
      const [credit, debit, profit] = bodyRows();
      expect(within(credit).getByText("CREDIT")).toHaveClass("text-emerald-400");
      expect(within(debit).getByText("DEBIT")).toHaveClass("text-red-400");
      expect(within(profit).getByText("PROFIT YIELD")).toHaveClass("text-blue-400");
    });
  });

  describe("filter chips", () => {
    const data = () => ({
      deposits: [deposit({ id: "d1", amount: 500, created_at: "2025-01-10T12:00:00Z" })],
      withdrawals: [withdrawal({ id: "w1", amount: 200, created_at: "2025-01-12T12:00:00Z" })],
      ledger: [ledgerEntry({ id: "l1", amount: 30, note: "Profit", created_at: "2025-01-14T12:00:00Z" })],
    });
    const tab = (name: string) => screen.getByRole("tab", { name });

    it("renders the four chips in a labelled tablist with All selected", () => {
      renderTable(data());
      expect(screen.getByRole("tablist", { name: "Filter transactions" })).toBeInTheDocument();
      expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual([
        "All",
        "Deposits",
        "Withdrawals",
        "Profit & adjustments",
      ]);
      expect(tab("All")).toHaveAttribute("aria-selected", "true");
      expect(tab("Deposits")).toHaveAttribute("aria-selected", "false");
    });

    it("shows only deposits when Deposits is chosen", async () => {
      const { user } = renderTable(data());
      await user.click(tab("Deposits"));
      expect(amounts()).toEqual(["+$500.00"]);
      expect(tab("Deposits")).toHaveAttribute("aria-selected", "true");
      expect(tab("All")).toHaveAttribute("aria-selected", "false");
    });

    it("shows only withdrawals when Withdrawals is chosen", async () => {
      const { user } = renderTable(data());
      await user.click(tab("Withdrawals"));
      expect(amounts()).toEqual(["-$200.00"]);
    });

    it("shows only ledger entries when Profit & adjustments is chosen", async () => {
      const { user } = renderTable(data());
      await user.click(tab("Profit & adjustments"));
      expect(amounts()).toEqual(["+$30.00"]);
    });

    it("returns to everything when All is chosen again", async () => {
      const { user } = renderTable(data());
      await user.click(tab("Deposits"));
      await user.click(tab("All"));
      expect(bodyRows()).toHaveLength(3);
    });

    it("shows the empty state when a filter matches nothing", async () => {
      const { user } = renderTable({ deposits: [deposit()] });
      await user.click(tab("Withdrawals"));
      expect(screen.getByText("No transactions yet.")).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });
  });

  describe("realtime", () => {
    it("subscribes to ledger INSERTs for this user", () => {
      renderTable();
      expect(realtime.channelName).toBe("transactions-u1");
      expect(realtime.config).toEqual({
        event: "INSERT",
        schema: "public",
        table: "ledger_entries",
        filter: "user_id=eq.u1",
      });
    });

    it("adds an inserted ledger row without a reload", () => {
      renderTable({ deposits: [deposit({ amount: 500, created_at: "2025-01-10T12:00:00Z" })] });
      expect(bodyRows()).toHaveLength(1);

      act(() => {
        realtime.handler?.({
          new: ledgerEntry({ id: "live", type: "PROFIT_YIELD", amount: 42, note: "Live profit", created_at: "2025-02-01T12:00:00Z" }),
        });
      });

      expect(bodyRows()).toHaveLength(2);
      expect(amounts()[0]).toBe("+$42.00");
      expect(labels()[0]).toBe("Live profit");
    });

    it("replaces the empty state with the first live row", () => {
      renderTable();
      act(() => {
        realtime.handler?.({ new: ledgerEntry({ id: "live", amount: 7, note: "First" }) });
      });
      expect(screen.queryByText("No transactions yet.")).not.toBeInTheDocument();
      expect(amounts()).toEqual(["+$7.00"]);
    });

    it("applies the deposit-credit filter to live rows too", () => {
      renderTable();
      act(() => {
        realtime.handler?.({ new: ledgerEntry({ id: "live", type: "CREDIT", amount: 7, note: "Deposit approved (USDT)" }) });
      });
      expect(screen.getByText("No transactions yet.")).toBeInTheDocument();
    });

    it("respects the active filter for live rows", async () => {
      const { user } = renderTable({ deposits: [deposit({ amount: 500 })] });
      await user.click(screen.getByRole("tab", { name: "Deposits" }));
      act(() => {
        realtime.handler?.({ new: ledgerEntry({ id: "live", amount: 7, note: "Live" }) });
      });
      expect(amounts()).toEqual(["+$500.00"]);
      await user.click(screen.getByRole("tab", { name: "Profit & adjustments" }));
      expect(amounts()).toEqual(["+$7.00"]);
    });

    it("removes the channel on unmount", () => {
      const { unmount } = renderTable();
      expect(realtime.removed).toBe(0);
      unmount();
      expect(realtime.removed).toBe(1);
    });
  });

  describe("localisation", () => {
    it("renders French filters, headers, labels and statuses", () => {
      renderTable(
        {
          deposits: [deposit({ method: "BANK_TRANSFER", status: "PENDING", created_at: "2025-01-02T12:00:00Z" })],
          withdrawals: [withdrawal({ status: "COMPLETED", created_at: "2025-01-01T12:00:00Z" })],
        },
        "fr",
      );
      expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Toutes", "Dépôts", "Retraits", "Profits et ajustements"]);
      expect(labels()).toEqual(["Dépôt · Virement bancaire", "Retrait · Virement bancaire"]);
      expect(within(bodyRows()[0]).getByText("EN ATTENTE")).toBeInTheDocument();
      expect(within(bodyRows()[1]).getByText("TERMINÉ")).toBeInTheDocument();
    });

    it("renders Chinese filters and the empty state", () => {
      renderTable({}, "zh");
      expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["全部", "存款", "提款", "收益与调整"]);
      expect(screen.getByText("暂无交易记录。")).toBeInTheDocument();
    });
  });
});
