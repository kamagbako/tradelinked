import type { Metadata } from "next";
import { Search } from "lucide-react";
import { UserTable, type AdminUserRow } from "@/components/admin/UserTable";
import { createClient } from "@/lib/supabase/server";
import { sanitizeSearchTerm } from "@/lib/search";

export const metadata: Metadata = { title: "Users" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select("id, email, full_name, role, is_frozen, balances(available_balance)")
    .order("created_at", { ascending: false });

  const term = sanitizeSearchTerm(q);
  if (term) {
    query = query.or(`email.ilike.%${term}%,full_name.ilike.%${term}%`);
  }

  const [{ data }, { data: unreadRows }] = await Promise.all([
    query,
    supabase.from("messages").select("user_id").eq("sender", "USER").is("read_at", null),
  ]);

  const unreadByUser = new Map<string, number>();
  for (const row of unreadRows ?? []) {
    unreadByUser.set(row.user_id, (unreadByUser.get(row.user_id) ?? 0) + 1);
  }

  const rows: AdminUserRow[] = (data ?? []).map((row) => {
    const balances = row.balances as
      | { available_balance: number | string }
      | { available_balance: number | string }[]
      | null;
    const balance = Array.isArray(balances) ? balances[0] : balances;
    return {
      id: row.id,
      email: row.email,
      full_name: row.full_name,
      role: row.role,
      is_frozen: row.is_frozen,
      available_balance: Number(balance?.available_balance ?? 0),
      unread_messages: unreadByUser.get(row.id) ?? 0,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-text">User Directory</h1>
        <form className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by name or email"
            className="min-h-[44px] w-full rounded-xl border border-border bg-bg pl-10 pr-3.5 text-sm text-text placeholder:text-text-muted focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
          />
        </form>
      </div>

      <UserTable rows={rows} />
    </div>
  );
}
