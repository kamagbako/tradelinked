"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { runAction } from "@/lib/errors";
import { getPlan } from "@/lib/plans";
import { formatCurrency } from "@/lib/utils";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

/**
 * Self-service plan activation: `active_plan` is a display label only (it never moves money —
 * deposits, withdrawals and profit are handled separately via the ledger), so this just writes the
 * user's own profile row. Gated on their available balance meeting the plan's minimum deposit, re-read
 * from the server so the check can't be bypassed by a stale or tampered client value.
 */
async function activatePlanImpl(planId: string): Promise<ActionResult> {
  const t = await getTranslations("dashboard");
  const plan = getPlan(planId);
  if (!plan) return { error: t("errors.planNotFound") };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: t("errors.signedIn") };

  const { data: balance } = await supabase
    .from("balances")
    .select("available_balance")
    .eq("user_id", userData.user.id)
    .single();

  const available = Number(balance?.available_balance ?? 0);
  if (available < plan.minDeposit) {
    return { error: t("errors.planBelowMinimum", { amount: formatCurrency(plan.minDeposit) }) };
  }

  const { error } = await supabase.from("profiles").update({ active_plan: plan.id }).eq("id", userData.user.id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard", "layout");
  return { success: true };
}

export async function activatePlan(planId: string): Promise<ActionResult> {
  return runAction("plans.activate", () => activatePlanImpl(planId));
}
