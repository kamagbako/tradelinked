import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PlansPicker } from "@/components/dashboard/PlansPicker";
import { requireUser } from "@/lib/auth/guard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard");
  return { title: t("nav.plans") };
}

export default async function PlansPage() {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("dashboard");

  const [{ data: profile }, { data: balance }] = await Promise.all([
    supabase.from("profiles").select("active_plan").eq("id", user.id).single(),
    supabase.from("balances").select("available_balance").eq("user_id", user.id).single(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text">{t("plans.heading")}</h1>
        <p className="-mt-1 text-sm text-text-muted">{t("plans.subtitle")}</p>
      </div>

      <PlansPicker
        activePlanId={profile?.active_plan ?? null}
        availableBalance={Number(balance?.available_balance ?? 0)}
      />
    </div>
  );
}
