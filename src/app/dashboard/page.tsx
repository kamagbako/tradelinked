import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { InstallPrompt } from "@/components/layout/InstallPrompt";
import { NotificationBanner, PlanBanner, TwoFactorBanner } from "@/components/dashboard/Banners";
import { StatCard } from "@/components/dashboard/StatCard";
import { WidgetBoundary } from "@/components/error/ErrorBoundary";
import { TradingViewScreener } from "@/components/dashboard/TradingViewScreener";
import { TradingViewTicker } from "@/components/dashboard/TradingViewTicker";
import { Stagger, StaggerItem } from "@/components/motion/Reveal";
import { requireUser } from "@/lib/auth/guard";
import { getPlan } from "@/lib/plans";
import { formatCurrency } from "@/lib/utils";
import type { DepositStatus, WithdrawalStatus } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard");
  return { title: t("nav.dashboard") };
}

function sum(rows: { amount: number; status: string }[], ...statuses: string[]) {
  return rows
    .filter((row) => statuses.length === 0 || statuses.includes(row.status))
    .reduce((total, row) => total + Number(row.amount), 0);
}

function count(rows: { status: string }[], status: string) {
  return rows.filter((row) => row.status === status).length;
}

export default async function DashboardPage() {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("dashboard");

  const [{ data: profile }, { data: balance }, { data: deposits }, { data: withdrawals }, { data: factors }] =
    await Promise.all([
      supabase.from("profiles").select("active_plan").eq("id", user.id).single(),
      supabase.from("balances").select("*").eq("user_id", user.id).single(),
      supabase.from("deposits").select("amount, status").eq("user_id", user.id),
      supabase.from("withdrawals").select("amount, status").eq("user_id", user.id),
      supabase.auth.mfa.listFactors(),
    ]);

  const dep = (deposits ?? []) as { amount: number; status: DepositStatus }[];
  const wd = (withdrawals ?? []) as { amount: number; status: WithdrawalStatus }[];
  const hasTwoFactor = (factors?.totp ?? []).length > 0;

  // `active_plan` stores a plan id (e.g. "growth"); translate it for display, falling back to the raw
  // value for any legacy/manually-set text that doesn't match a known plan.
  const activePlan = profile?.active_plan ? getPlan(profile.active_plan) : undefined;
  const tPlanItems = await getTranslations("landing.plans.items");
  const activePlanName = activePlan ? tPlanItems(`${activePlan.id}.name`) : profile?.active_plan ?? null;

  return (
    <div className="flex flex-col gap-6">
      <InstallPrompt />

      <WidgetBoundary name="market-ticker">
        <TradingViewTicker />
      </WidgetBoundary>

      <NotificationBanner />
      {!hasTwoFactor && <TwoFactorBanner />}
      <PlanBanner activePlanName={activePlanName} />

      <Stagger trigger="mount" stagger={0.18} className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <StaggerItem>
          <StatCard
            title={t("home.deposits.title")}
            value={`${formatCurrency(sum(dep, "APPROVED"))} USD`}
            columns={[
              { label: t("home.columns.submitted"), value: `${formatCurrency(sum(dep))} USD` },
              { label: t("home.columns.pending"), value: `${formatCurrency(sum(dep, "PENDING"))} USD` },
              { label: t("home.columns.rejected"), value: `${formatCurrency(sum(dep, "REJECTED"))} USD` },
            ]}
            footer={t("home.deposits.footer", {
              total: dep.length,
              approved: count(dep, "APPROVED"),
              pending: count(dep, "PENDING"),
              rejected: count(dep, "REJECTED"),
            })}
          />
        </StaggerItem>

        <StaggerItem>
          <StatCard
            title={t("home.withdrawals.title")}
            value={`${formatCurrency(sum(wd, "COMPLETED"))} USD`}
            columns={[
              { label: t("home.columns.submitted"), value: `${formatCurrency(sum(wd))} USD` },
              { label: t("home.columns.pending"), value: `${formatCurrency(sum(wd, "PENDING"))} USD` },
              { label: t("home.columns.rejected"), value: `${formatCurrency(sum(wd, "REJECTED"))} USD` },
            ]}
            footer={t("home.withdrawals.footer", {
              total: wd.length,
              completed: count(wd, "COMPLETED"),
              pending: count(wd, "PENDING"),
              rejected: count(wd, "REJECTED"),
            })}
          />
        </StaggerItem>

        <StaggerItem className="md:col-span-2 xl:col-span-1">
          <StatCard
            title={t("home.earnings.title")}
            value={`${formatCurrency(Number(balance?.total_profit ?? 0))} USD`}
            columns={[
              { label: t("home.columns.available"), value: `${formatCurrency(Number(balance?.available_balance ?? 0))} USD` },
              { label: t("home.columns.deposited"), value: `${formatCurrency(Number(balance?.total_deposited ?? 0))} USD` },
              { label: t("home.columns.plan"), value: activePlanName ?? t("home.none") },
            ]}
            footer={
              activePlanName
                ? t("home.earnings.footerActive", { plan: activePlanName })
                : t("home.earnings.footerNone")
            }
          />
        </StaggerItem>
      </Stagger>

      <div>
        <h2 className="mb-4 text-2xl font-bold text-text">{t("home.marketStats")}</h2>
        <WidgetBoundary name="market-screener">
          <TradingViewScreener />
        </WidgetBoundary>
      </div>
    </div>
  );
}
