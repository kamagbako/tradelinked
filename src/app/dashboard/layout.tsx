import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { requireUser } from "@/lib/auth/guard";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireUser();

  const [{ data: profile }, { data: balance }, { count: unreadMessages }] = await Promise.all([
    supabase.from("profiles").select("full_name, email, role").eq("id", user.id).single(),
    supabase.from("balances").select("available_balance").eq("user_id", user.id).single(),
    supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("sender", "ADMIN")
      .is("read_at", null),
  ]);

  return (
    <DashboardShell
      userId={user.id}
      name={profile?.full_name ?? null}
      email={profile?.email ?? user.email ?? ""}
      balance={Number(balance?.available_balance ?? 0)}
      isAdmin={profile?.role === "ADMIN"}
      unreadMessages={unreadMessages ?? 0}
    >
      {children}
    </DashboardShell>
  );
}
