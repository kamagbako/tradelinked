import type { Metadata } from "next";
import { LedgerConsole } from "@/components/admin/LedgerConsole";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Manual Ledger" };

export default async function AdminLedgerPage({
  searchParams,
}:{
  searchParams: Promise<{ userId?: string }>;
}){
  const { userId } = await searchParams;
  const supabase = await createClient();

  const { data: users } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .order("email");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-text">Manual Ledger Console</h1>
      <LedgerConsole users={users ?? []} defaultUserId={userId} />
    </div>
  );
}
