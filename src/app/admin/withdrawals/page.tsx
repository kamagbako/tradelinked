import type { Metadata } from "next";
import { WithdrawalQueue } from "@/components/admin/WithdrawalQueue";
import { createClient } from "@/lib/supabase/server";
import type { Withdrawal } from "@/lib/types";

export const metadata: Metadata = { title: "Withdrawals" };

export default async function AdminWithdrawalsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("withdrawals")
    .select("*, profiles(email, full_name)")
    .eq("status", "PENDING")
    .order("created_at", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-text">Pending Withdrawals</h1>
      <WithdrawalQueue initialWithdrawals={(data ?? []) as Withdrawal[]} />
    </div>
  );
}
