import type { Metadata } from "next";
import { DepositQueue } from "@/components/admin/DepositQueue";
import { createClient } from "@/lib/supabase/server";
import type { Deposit } from "@/lib/types";

export const metadata: Metadata = { title: "Deposits" };

export default async function AdminDepositsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("deposits")
    .select("*, profiles(email, full_name)")
    .eq("status", "PENDING")
    .order("created_at", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-text">Pending Deposits</h1>
      <p className="-mt-3 text-sm text-text-muted">
        Verify each transfer against your bank or wallet before approving. Approving credits the user&apos;s balance.
      </p>
      <DepositQueue initialDeposits={(data ?? []) as Deposit[]} />
    </div>
  );
}
