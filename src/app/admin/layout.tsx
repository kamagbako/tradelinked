import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { AdminNav } from "@/components/admin/AdminNav";
import { requireUser } from "@/lib/auth/guard";
import { signOut } from "@/lib/actions/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireUser();

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <Link href="/admin" className="flex items-center gap-2 font-semibold text-text">
            <ShieldCheck className="h-6 w-6 text-blue-500" />
            TradeLinked Admin
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <form action={signOut}>
              <button
                type="submit"
                className="flex h-11 w-11 items-center justify-center rounded-full text-text-muted hover:bg-hover hover:text-text"
                aria-label="Log out"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="flex">
        <AdminNav />
        <main className="min-w-0 flex-1 p-4 pb-24 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
