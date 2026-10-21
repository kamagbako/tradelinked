import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TransactionsTable } from "@/components/dashboard/TransactionsTable";
import { requireUser } from "@/lib/auth/guard";
import type { Deposit, LedgerEntry, Withdrawal } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard");
  return { title: t("nav.transactions") };
}

export default async function TransactionsPage() {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("dashboard");

  const recent = (table: string) =>
    supabase.from(table).select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);

  const [{ data: deposits }, { data: withdrawals }, { data: ledger }] = await Promise.all([
    recent("deposits"),
    recent("withdrawals"),
    recent("ledger_entries"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-text">{t("transactions.heading")}</h1>
      <TransactionsTable
        userId={user.id}
        deposits={(deposits ?? []) as Deposit[]}
        withdrawals={(withdrawals ?? []) as Withdrawal[]}
        ledger={(ledger ?? []) as LedgerEntry[]}
      />
    </div>
  );
}
