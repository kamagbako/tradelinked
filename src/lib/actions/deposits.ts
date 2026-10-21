"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { isWithinDepositLimits } from "@/lib/deposit-fees";
import { sendDepositApprovedEmail, sendDepositRejectedEmail } from "@/lib/email/notifications";
import { notifyIfLowBalance } from "@/lib/balance-alerts";
import { formatCurrency } from "@/lib/utils";
import type { DepositStatus } from "@/lib/types";
import { runAction } from "@/lib/errors";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

async function submitDepositImpl(formData: FormData): Promise<ActionResult> {
  const t = await getTranslations("dashboard");
  const amount = Number(formData.get("amount"));
  const reference = String(formData.get("reference") ?? "").trim() || null;

  if (!amount || amount <= 0) {
    return { error: t("errors.depositAmount") };
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { error: t("errors.signedIn") };
  }

  // Re-checked server-side against the admin-configured limits, not just the client's live preview.
  const { data: settings } = await supabase
    .from("company_settings")
    .select("deposit_min_usd, deposit_max_usd")
    .eq("id", 1)
    .single();
  const minUsd = Number(settings?.deposit_min_usd ?? 0);
  const maxUsd = settings ? Number(settings.deposit_max_usd) : Infinity;
  if (!isWithinDepositLimits(amount, { minUsd, maxUsd })) {
    return { error: t("errors.depositOutsideLimits", { min: formatCurrency(minUsd), max: formatCurrency(maxUsd) }) };
  }

  // Deposits are Bitcoin-only.
  const { error } = await supabase
    .from("deposits")
    .insert({ user_id: userData.user.id, amount, method: "BTC", reference });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}

async function resolveDepositImpl(
  depositId: string,
  status: Exclude<DepositStatus, "PENDING">,
  rejectionReason?: string,
): Promise<ActionResult> {
  const reason = rejectionReason?.trim() || null;
  const supabase = await createClient();

  const { error } = await supabase.rpc("resolve_deposit", {
    p_deposit_id: depositId,
    p_status: status,
    p_rejection_reason: reason,
  });

  if (error) {
    return { error: error.message };
  }

  // Looked up after resolving (rather than before, like withdrawals) because the original deposit
  // flow had no need for it — this keeps that simpler path intact and only adds the email lookup.
  const { data: deposit } = await supabase
    .from("deposits")
    .select("*, profiles(email)")
    .eq("id", depositId)
    .single();

  const userEmail = deposit?.profiles?.email;
  if (userEmail) {
    if (status === "APPROVED") {
      await sendDepositApprovedEmail({ userEmail, amount: Number(deposit.amount) });
      await notifyIfLowBalance(deposit.user_id);
    } else if (status === "REJECTED") {
      const { data: settings } = await supabase.from("company_settings").select("whatsapp_support_url").single();
      await sendDepositRejectedEmail({
        userEmail,
        amount: Number(deposit.amount),
        reason: reason ?? "Not specified.",
        supportUrl: settings?.whatsapp_support_url ?? process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT_URL ?? "",
      });
    }
  }

  revalidatePath("/admin/deposits");
  revalidatePath("/dashboard", "layout");
  return { success: true };
}

export async function submitDeposit(formData: FormData): Promise<ActionResult> {
  return runAction("deposits.submit", () => submitDepositImpl(formData));
}

export async function resolveDeposit(depositId: string,
  status: Exclude<DepositStatus, "PENDING">,
  rejectionReason?: string): Promise<ActionResult> {
  return runAction("deposits.resolve", () => resolveDepositImpl(depositId, status, rejectionReason));
}
