"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/ui/ResponsiveTable";
import { subscribeToTable } from "@/lib/supabase/realtime";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { Deposit, LedgerEntry, Withdrawal } from "@/lib/types";

type Kind = "Deposit" | "Withdrawal" | "Ledger";

interface Row {
  id: string;
  kind: Kind;
  /** Deposit / withdrawal payout method, or the ledger entry type (used to build the translated label). */
  method: string;
  /** Free-text ledger note, shown as-is when present. */
  note: string | null;
  amount: number;
  direction: 1 | -1;
  status: string;
  created_at: string;
}

const FILTERS: ("All" | Kind)[] = ["All", "Deposit", "Withdrawal", "Ledger"];

const statusTone: Record<string, "success" | "warning" | "danger" | "info"> = {
  APPROVED: "success",
  COMPLETED: "success",
  CREDIT: "success",
  PENDING: "warning",
  REJECTED: "danger",
  DEBIT: "danger",
  PROFIT_YIELD: "info",
};

// Approved deposits also create a CREDIT ledger line; the deposit row already covers it.
const isDepositCredit = (e: LedgerEntry) => e.type === "CREDIT" && (e.note ?? "").startsWith("Deposit approved");

function toRows(deposits: Deposit[], withdrawals: Withdrawal[], ledger: LedgerEntry[]): Row[] {
  return [
    ...deposits.map((d): Row => ({
      id: `d-${d.id}`, kind: "Deposit", method: d.method, note: null,
      amount: Number(d.amount), direction: 1, status: d.status, created_at: d.created_at,
    })),
    ...withdrawals.map((w): Row => ({
      id: `w-${w.id}`, kind: "Withdrawal", method: w.payout_method, note: null,
      amount: Number(w.amount), direction: -1, status: w.status, created_at: w.created_at,
    })),
    ...ledger.filter((e) => !isDepositCredit(e)).map((e): Row => ({
      id: `l-${e.id}`, kind: "Ledger", method: e.type, note: e.note || null,
      amount: Number(e.amount), direction: e.type === "DEBIT" ? -1 : 1, status: e.type, created_at: e.created_at,
    })),
  ].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
}

export function TransactionsTable({
  userId, deposits, withdrawals, ledger,
}: { userId: string; deposits: Deposit[]; withdrawals: Withdrawal[]; ledger: LedgerEntry[] }) {
  const t = useTranslations("dashboard");
  const [liveLedger, setLiveLedger] = useState(ledger);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");

  useEffect(() => {
    return subscribeToTable(`transactions-${userId}`, { event: "INSERT", schema: "public", table: "ledger_entries", filter: `user_id=eq.${userId}` }, (payload) => setLiveLedger((prev) => [payload.new as LedgerEntry, ...prev]));
  }, [userId]);

  const rows = useMemo(() => toRows(deposits, withdrawals, liveLedger), [deposits, withdrawals, liveLedger]);
  const visible = filter === "All" ? rows : rows.filter((r) => r.kind === filter);

  const translate = (group: "methods" | "statuses", value: string) =>
    t.has(`${group}.${value}`) ? t(`${group}.${value}`) : value.replace("_", " ");

  const labelOf = (r: Row) => {
    if (r.kind === "Deposit") return t("transactions.depositLabel", { method: translate("methods", r.method) });
    if (r.kind === "Withdrawal") return t("transactions.withdrawalLabel", { method: translate("methods", r.method) });
    return r.note || translate("statuses", r.method);
  };

  const columns: ResponsiveColumn<Row>[] = [
    {
      key: "amount", header: t("transactions.columns.amount"), primary: true,
      render: (r) => (
        <span className={cn("font-semibold", r.direction === 1 ? "text-emerald-400" : "text-red-400")}>
          {r.direction === 1 ? "+" : "-"}{formatCurrency(r.amount)}
        </span>
      ),
    },
    { key: "label", header: t("transactions.columns.transaction"), render: (r) => labelOf(r) },
    { key: "status", header: t("transactions.columns.status"), render: (r) => <Badge tone={statusTone[r.status] ?? "neutral"}>{translate("statuses", r.status)}</Badge> },
    { key: "created_at", header: t("transactions.columns.date"), render: (r) => formatDate(r.created_at) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("transactions.filterLabel")}>
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              "min-h-[40px] rounded-full border px-4 text-sm font-medium transition-colors",
              filter === f ? "border-blue-500 bg-blue-500/15 text-blue-500" : "border-border text-text-muted hover:text-text",
            )}
          >
            {t(`transactions.filters.${f === "All" ? "all" : f === "Ledger" ? "ledger" : f === "Deposit" ? "deposit" : "withdrawal"}`)}
          </button>
        ))}
      </div>
      <ResponsiveTable columns={columns} rows={visible} rowKey={(r) => r.id} emptyState={t("transactions.empty")} />
    </div>
  );
}
