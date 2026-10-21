import type { Metadata } from "next";
import { Users, Wallet, Clock, TrendingUp } from "lucide-react";
import { Stagger, StaggerItem } from "@/components/motion/Reveal";
import { GlassCard } from "@/components/ui/GlassCard";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin Overview" };

export default async function AdminOverviewPage() {
  const supabase = await createClient();

  const [{ count: userCount }, { data: balances }, { data: pendingWithdrawals }] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("balances").select("available_balance, total_profit"),
    supabase.from("withdrawals").select("amount").eq("status", "PENDING"),
  ]);

  const totalBalance = (balances ?? []).reduce((sum, b) => sum + Number(b.available_balance), 0);
  const totalProfit = (balances ?? []).reduce((sum, b) => sum + Number(b.total_profit), 0);
  const pendingAmount = (pendingWithdrawals ?? []).reduce((sum, w) => sum + Number(w.amount), 0);

  const metrics = [
    { label: "Total Users", value: String(userCount ?? 0), icon: Users, accent: "text-blue-400 bg-blue-500/10" },
    { label: "Platform Balance", value: formatCurrency(totalBalance), icon: Wallet, accent: "text-emerald-400 bg-emerald-500/10" },
    { label: "Total Profit Distributed", value: formatCurrency(totalProfit), icon: TrendingUp, accent: "text-emerald-400 bg-emerald-500/10" },
    {
      label: "Pending Withdrawals",
      value: `${pendingWithdrawals?.length ?? 0} (${formatCurrency(pendingAmount)})`,
      icon: Clock,
      accent: "text-amber-400 bg-amber-500/10",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-text">Platform Overview</h1>
      <Stagger trigger="mount" stagger={0.08} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon, accent }) => (
          <StaggerItem key={label}>
          <GlassCard className="h-full">
            <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${accent}`}>
              <Icon className="h-5 w-5" />
            </div>
            <p className="text-xs text-text-muted">{label}</p>
            <p className="mt-1 text-xl font-bold text-text">{value}</p>
          </GlassCard>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}
