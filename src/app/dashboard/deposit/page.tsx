import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import QRCode from "qrcode";
import { DepositForm } from "@/components/dashboard/DepositForm";
import { RequestHistory, type RequestRow } from "@/components/dashboard/RequestHistory";
import { requireUser } from "@/lib/auth/guard";
import { getPlan } from "@/lib/plans";
import { logError } from "@/lib/logger";
import type { CompanySettings, Deposit } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard");
  return { title: t("nav.deposit") };
}

export default async function DepositPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan: planParam } = await searchParams;
  const { supabase, user } = await requireUser();
  const t = await getTranslations("dashboard");

  const [{ data: settings }, { data: deposits }, { data: profile }] = await Promise.all([
    supabase.from("company_settings").select("*").eq("id", 1).single(),
    supabase.from("deposits").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("profiles").select("active_plan").eq("id", user.id).single(),
  ]);

  const s = settings as CompanySettings | null;

  // Coming from a locked plan on the Plans page (?plan=<id>) pre-fills that plan's minimum; failing
  // that, the user's own already-active plan does. Either way it's just a convenient starting value —
  // the user can still change it.
  const targetPlan = getPlan(planParam ?? "") ?? getPlan(profile?.active_plan ?? "");

  let qrDataUrl: string | null = null;
  if (s?.btc_address) {
    try {
      qrDataUrl = await QRCode.toDataURL(s.btc_address, { margin: 1, width: 384 });
    } catch (error) {
      // The copyable address below still works without the QR code, so this is non-fatal.
      logError("deposit.qrCode", error);
    }
  }

  const history: RequestRow[] = ((deposits ?? []) as Deposit[]).map((d) => ({
    id: d.id,
    amount: Number(d.amount),
    method: d.method,
    status: d.status,
    detail: d.status === "REJECTED" ? d.rejection_reason : d.reference,
    created_at: d.created_at,
  }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-text">{t("deposit.heading")}</h1>

      <div className="mx-auto w-full max-w-2xl">
        <DepositForm
          btcAddress={s?.btc_address ?? null}
          qrDataUrl={qrDataUrl}
          feePercent={Number(s?.deposit_fee_percent ?? 0)}
          feeFlat={Number(s?.deposit_fee_flat ?? 0)}
          minUsd={Number(s?.deposit_min_usd ?? 10)}
          maxUsd={Number(s?.deposit_max_usd ?? 1_000_000)}
          initialAmount={targetPlan?.minDeposit ?? null}
        />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-text">{t("deposit.yourDeposits")}</h2>
        <RequestHistory rows={history} empty={t("deposit.empty")} />
      </div>
    </div>
  );
}
