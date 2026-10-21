"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyIfLowBalance } from "@/lib/balance-alerts";
import type { LedgerEntryType } from "@/lib/types";
import { runAction } from "@/lib/errors";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

/**
 * Applies a manual ledger entry via the `apply_ledger_entry` RPC, which locks
 * the balance row for the duration of the transaction. This is what protects
 * against a double-click submitting the same credit/debit twice.
 */
async function applyLedgerEntryImpl(formData: FormData): Promise<ActionResult> {
  const userId = String(formData.get("userId") ?? "");
  const type = String(formData.get("type") ?? "") as LedgerEntryType;
  const amount = Number(formData.get("amount"));
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!userId || !type) {
    return { error: "Select a user and entry type." };
  }
  if (!amount || amount <= 0) {
    return { error: "Enter a valid amount." };
  }

  const supabase = await createClient();
  const { data: actor } = await supabase.auth.getUser();

  const { error } = await supabase.rpc("apply_ledger_entry", {
    p_user_id: userId,
    p_type: type,
    p_amount: amount,
    p_note: note,
    p_created_by: actor.user?.id ?? null,
  });

  if (error) {
    return { error: error.message };
  }

  await notifyIfLowBalance(userId);

  revalidatePath("/admin/ledger");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function applyLedgerEntry(formData: FormData): Promise<ActionResult> {
  return runAction("ledger.apply", () => applyLedgerEntryImpl(formData));
}
