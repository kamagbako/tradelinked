import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { sendLowBalanceEmail } from "@/lib/email/notifications";
import { logError } from "@/lib/logger";

/**
 * Best-effort: emails a user once per dip below the admin-configured low-balance threshold, and
 * clears the flag once their balance recovers so a future dip notifies again. Uses the service-role
 * client because this runs after actions a regular user is allowed to trigger (e.g. their own
 * withdrawal), but only admins may write to `balances` under RLS — and because this is a side
 * effect of an already-successful action, a missing key or any other failure here is logged and
 * swallowed rather than surfaced to the caller.
 */
export async function notifyIfLowBalance(userId: string): Promise<void> {
  try {
    const supabase = createServiceClient();

    const [{ data: settings }, { data: balance }] = await Promise.all([
      supabase.from("company_settings").select("low_balance_threshold_usd").eq("id", 1).single(),
      supabase.from("balances").select("available_balance, low_balance_notified_at").eq("user_id", userId).single(),
    ]);

    const threshold = Number(settings?.low_balance_threshold_usd ?? 0);
    if (threshold <= 0 || !balance) return;

    const current = Number(balance.available_balance);
    const alreadyNotified = balance.low_balance_notified_at !== null;

    if (current < threshold && !alreadyNotified) {
      const { data: profile } = await supabase.from("profiles").select("email").eq("id", userId).single();
      if (profile?.email) {
        await sendLowBalanceEmail({ userEmail: profile.email, balance: current, threshold });
      }
      await supabase.from("balances").update({ low_balance_notified_at: new Date().toISOString() }).eq("user_id", userId);
    } else if (current >= threshold && alreadyNotified) {
      await supabase.from("balances").update({ low_balance_notified_at: null }).eq("user_id", userId);
    }
  } catch (error) {
    logError("balanceAlerts.notifyIfLowBalance", error);
  }
}
