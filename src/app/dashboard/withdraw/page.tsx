import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { RequestHistory, type RequestRow } from "@/components/dashboard/RequestHistory";
import { WithdrawalForm } from "@/components/dashboard/WithdrawalForm";
import { requireUser } from "@/lib/auth/guard";
import type { Withdrawal } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard");
  return { title: t("nav.withdraw") };
}

export default async function WithdrawPage() {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("dashboard");

  const { data } = await supabase
    .from("withdrawals")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const history: RequestRow[] = ((data ?? []) as Withdrawal[]).map((w) => ({
    id: w.id,
    amount: Number(w.amount),
    method: w.payout_method,
    status: w.status,
    detail: w.status === "REJECTED" ? w.rejection_reason : w.payout_details,
    created_at: w.created_at,
  }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-text">{t("withdraw.heading")}</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <WithdrawalForm />
        </div>
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-lg font-semibold text-text">{t("withdraw.yourWithdrawals")}</h2>
          <RequestHistory rows={history} empty={t("withdraw.empty")} />
        </div>
      </div>
    </div>
  );
}
