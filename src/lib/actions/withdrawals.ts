"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import {
  sendWithdrawalApprovedEmail,
  sendWithdrawalRejectedEmail,
  sendWithdrawalRequestedEmail,
} from "@/lib/email/notifications";
import { notifyIfLowBalance } from "@/lib/balance-alerts";
import type { PayoutMethod, WithdrawalStatus } from "@/lib/types";
import { runAction } from "@/lib/errors";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

async function submitWithdrawalImpl(formData: FormData): Promise<ActionResult> {
  const t = await getTranslations("dashboard");
  const amount = Number(formData.get("amount"));
  const payoutMethod = String(formData.get("payoutMethod") ?? "") as PayoutMethod;
  const payoutDetails = String(formData.get("payoutDetails") ?? "").trim();

  if (!amount || amount <= 0) {
    return { error: t("errors.withdrawalAmount") };
  }
  if (!payoutMethod || !payoutDetails) {
    return { error: t("errors.payoutRequired") };
  }

  const supabase = await createClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) {
    return { error: t("errors.signedIn") };
  }

  const { error } = await supabase.rpc("request_withdrawal", {
    p_amount: amount,
    p_payout_method: payoutMethod,
    p_payout_details: payoutDetails,
  });

  if (error) {
    return { error: error.message };
  }

  await sendWithdrawalRequestedEmail({
    userEmail: userData.user.email!,
    amount,
    payoutMethod,
  });
  await notifyIfLowBalance(userData.user.id);

  revalidatePath("/dashboard", "layout");
  return { success: true };
}

async function resolveWithdrawalImpl(
  withdrawalId: string,
  status: WithdrawalStatus,
  rejectionReason?: string,
): Promise<ActionResult> {
  if (status === "PENDING") {
    return { error: "Invalid target status." };
  }

  // A blank reason is "no reason": stored as null and shown to the user as "Not specified.".
  const reason = rejectionReason?.trim() || null;

  const supabase = await createClient();

  const { data: withdrawal, error: fetchError } = await supabase
    .from("withdrawals")
    .select("*, profiles(email, full_name)")
    .eq("id", withdrawalId)
    .single();

  if (fetchError || !withdrawal) {
    return { error: "Withdrawal not found." };
  }

  if (withdrawal.status !== "PENDING") {
    return { error: "This withdrawal has already been resolved." };
  }

  const { error } = await supabase.rpc("resolve_withdrawal", {
    p_withdrawal_id: withdrawalId,
    p_status: status,
    p_rejection_reason: reason,
  });

  if (error) {
    return { error: error.message };
  }

  const userEmail = withdrawal.profiles?.email;
  if (userEmail) {
    if (status === "COMPLETED") {
      await sendWithdrawalApprovedEmail({
        userEmail,
        amount: withdrawal.amount,
        payoutMethod: withdrawal.payout_method,
      });
    } else if (status === "REJECTED") {
      const { data: settings } = await supabase
        .from("company_settings")
        .select("whatsapp_support_url")
        .single();

      await sendWithdrawalRejectedEmail({
        userEmail,
        amount: withdrawal.amount,
        reason: reason ?? "Not specified.",
        supportUrl: settings?.whatsapp_support_url ?? process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT_URL ?? "",
      });
    }
  }

  // A rejection refunds the locked amount back to available_balance — may bring it back above
  // the alert threshold (or, in principle, below it if the threshold itself just changed).
  if (status === "REJECTED") {
    await notifyIfLowBalance(withdrawal.user_id);
  }

  revalidatePath("/admin/withdrawals");
  revalidatePath("/dashboard", "layout");
  return { success: true };
}

export async function submitWithdrawal(formData: FormData): Promise<ActionResult> {
  return runAction("withdrawals.submit", () => submitWithdrawalImpl(formData));
}

export async function resolveWithdrawal(withdrawalId: string,
  status: WithdrawalStatus,
  rejectionReason?: string): Promise<ActionResult> {
  return runAction("withdrawals.resolve", () => resolveWithdrawalImpl(withdrawalId, status, rejectionReason));
}
