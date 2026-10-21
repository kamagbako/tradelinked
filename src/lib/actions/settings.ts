"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runAction } from "@/lib/errors";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

// The admin panel is English-only, so these messages aren't run through next-intl.
function parseNonNegativeNumber(formData: FormData, key: string, label: string): number | { error: string } {
  const raw = String(formData.get(key) ?? "").trim();
  if (raw === "") return 0;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return { error: `${label} must be a number of 0 or more.` };
  return value;
}

async function updateCompanySettingsImpl(formData: FormData): Promise<ActionResult> {
  const feePercent = parseNonNegativeNumber(formData, "depositFeePercent", "Deposit fee percentage");
  if (typeof feePercent === "object") return feePercent;
  if (feePercent > 100) return { error: "Deposit fee percentage can't be more than 100." };

  const feeFlat = parseNonNegativeNumber(formData, "depositFeeFlat", "Deposit flat fee");
  if (typeof feeFlat === "object") return feeFlat;

  const minUsd = parseNonNegativeNumber(formData, "depositMinUsd", "Minimum deposit");
  if (typeof minUsd === "object") return minUsd;

  const maxUsd = parseNonNegativeNumber(formData, "depositMaxUsd", "Maximum deposit");
  if (typeof maxUsd === "object") return maxUsd;

  if (maxUsd > 0 && maxUsd < minUsd) {
    return { error: "Maximum deposit can't be less than the minimum deposit." };
  }

  const lowBalanceThreshold = parseNonNegativeNumber(formData, "lowBalanceThresholdUsd", "Low balance alert threshold");
  if (typeof lowBalanceThreshold === "object") return lowBalanceThreshold;

  const supabase = await createClient();

  const payload = {
    bank_name: String(formData.get("bankName") ?? "").trim() || null,
    bank_account_name: String(formData.get("bankAccountName") ?? "").trim() || null,
    bank_account_number: String(formData.get("bankAccountNumber") ?? "").trim() || null,
    btc_address: String(formData.get("btcAddress") ?? "").trim() || null,
    usdt_address: String(formData.get("usdtAddress") ?? "").trim() || null,
    whatsapp_support_url: String(formData.get("whatsappSupportUrl") ?? "").trim() || null,
    deposit_fee_percent: feePercent,
    deposit_fee_flat: feeFlat,
    deposit_min_usd: minUsd,
    deposit_max_usd: maxUsd,
    low_balance_threshold_usd: lowBalanceThreshold,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("company_settings").update(payload).eq("id", 1);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/dashboard/deposit");
  return { success: true };
}

async function toggleUserFreezeImpl(userId: string, isFrozen: boolean): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ is_frozen: isFrozen })
    .eq("id", userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/users");
  return { success: true };
}

export async function updateCompanySettings(formData: FormData): Promise<ActionResult> {
  return runAction("settings.update", () => updateCompanySettingsImpl(formData));
}

export async function toggleUserFreeze(userId: string, isFrozen: boolean): Promise<ActionResult> {
  return runAction("settings.toggleFreeze", () => toggleUserFreezeImpl(userId, isFrozen));
}
