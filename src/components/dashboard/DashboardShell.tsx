"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { LogOut, ShieldCheck, TrendingUp } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Logo } from "@/components/ui/Logo";
import { AvatarMenu } from "@/components/dashboard/AvatarMenu";
import { MobileNav } from "@/components/dashboard/MobileNav";
import { SidebarBalance } from "@/components/dashboard/SidebarBalance";
import { NAV_ITEMS, isActive } from "@/components/dashboard/nav";
import { WidgetBoundary } from "@/components/error/ErrorBoundary";
import { ChatWidget } from "@/components/marketing/ChatWidget";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { signOut } from "@/lib/actions/auth";
import { subscribeToTable } from "@/lib/supabase/realtime";
import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DashboardShellProps {
  userId: string;
  name: string | null;
  email: string;
  balance: number;
  isAdmin?: boolean;
  unreadMessages?: number;
  children: ReactNode;
}

export function DashboardShell({
  userId,
  name,
  email,
  balance,
  isAdmin = false,
  unreadMessages: initialUnreadMessages = 0,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const t = useTranslations("dashboard");
  const [unreadMessages, setUnreadMessages] = useState(initialUnreadMessages);

  // Live badge: a new admin message bumps the count up, the user reading it (elsewhere, e.g.
  // the Messages page) brings it back down — both without needing a full page reload.
  useEffect(() => {
    const unsubscribeInsert = subscribeToTable<Message>(
      `dashboard-messages-insert-${userId}`,
      { event: "INSERT", schema: "public", table: "messages", filter: `user_id=eq.${userId}` },
      (payload) => {
        if (payload.new.sender === "ADMIN") setUnreadMessages((count) => count + 1);
      },
    );
    const unsubscribeUpdate = subscribeToTable<Message>(
      `dashboard-messages-update-${userId}`,
      { event: "UPDATE", schema: "public", table: "messages", filter: `user_id=eq.${userId}` },
      (payload) => {
        if (payload.new.sender === "ADMIN" && payload.new.read_at) {
          setUnreadMessages((count) => Math.max(0, count - 1));
        }
      },
    );
    return () => {
      unsubscribeInsert();
      unsubscribeUpdate();
    };
  }, [userId]);

  return (
    <div className="min-h-screen bg-bg">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col overflow-y-auto border-r border-border bg-surface lg:flex">
        <div className="flex h-20 items-center px-7">
          <Logo href="/dashboard" iconClassName="h-8 w-8" textClassName="text-xl" />
        </div>

        <div className="px-7 pt-4">
          <SidebarBalance userId={userId} initialBalance={balance} />
          <div className="mt-5 flex gap-3">
            <Link
              href="/dashboard/deposit"
              className="flex min-h-[44px] items-center rounded-lg bg-emerald-500 px-5 text-sm font-semibold text-white transition-transform hover:bg-emerald-600 active:scale-95"
            >
              {t("shell.deposit")}
            </Link>
            <Link
              href="/dashboard/withdraw"
              className="flex min-h-[44px] items-center rounded-lg bg-text px-5 text-sm font-semibold text-bg transition-transform hover:opacity-90 active:scale-95"
            >
              {t("shell.withdraw")}
            </Link>
          </div>
        </div>

        <nav aria-label={t("shell.navLabel")} className="mt-8 flex flex-1 flex-col gap-1 px-4 pb-6">
          {NAV_ITEMS.map(({ key, href, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-[48px] items-center gap-4 rounded-full px-5 text-[15px] font-semibold transition-colors",
                  active ? "text-blue-500" : "text-text-muted hover:text-text",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="sidebar-pill"
                    transition={{ type: "spring", stiffness: 220, damping: 26 }}
                    className="absolute inset-0 rounded-full bg-blue-500/12"
                  />
                )}
                <Icon className="relative h-5 w-5" />
                <span className="relative">{t(`nav.${key}`)}</span>
                {key === "messages" && unreadMessages > 0 && (
                  <span className="relative ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white">
                    {unreadMessages > 9 ? "9+" : unreadMessages}
                  </span>
                )}
              </Link>
            );
          })}

          {isAdmin && (
            <Link
              href="/admin"
              className="flex min-h-[48px] items-center gap-4 rounded-full px-5 text-[15px] font-semibold text-amber-500 transition-colors hover:text-amber-400"
            >
              <ShieldCheck className="h-5 w-5" />
              {t("shell.adminPanel")}
            </Link>
          )}

          <form action={signOut}>
            <button
              type="submit"
              className="flex min-h-[48px] w-full items-center gap-4 rounded-full px-5 text-[15px] font-semibold text-text-muted transition-colors hover:text-red-400"
            >
              <LogOut className="h-5 w-5" />
              {t("shell.logout")}
            </button>
          </form>
        </nav>
      </aside>

      <div className="lg:pl-72">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-border bg-bg/80 px-4 backdrop-blur-md sm:px-6 lg:h-20 lg:px-10">
          <div className="lg:hidden">
            <Logo href="/dashboard" />
          </div>
          <span className="hidden lg:block" />

          <div className="flex items-center gap-2">
            <SidebarBalance userId={userId} initialBalance={balance} compact className="lg:hidden" />
            <LanguageSwitcher className="hidden sm:block" />
            <ThemeToggle />
            <AvatarMenu name={name} email={email} isAdmin={isAdmin} />
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-32 pt-6 sm:px-6 lg:px-10 lg:pb-12">{children}</main>
      </div>

      <MobileNav isAdmin={isAdmin} unreadMessages={unreadMessages} />
      {/* Sits above the floating mobile bar on small screens. */}
      <WidgetBoundary name="chat" silent>
        <ChatWidget className="bottom-28 sm:bottom-28 lg:bottom-6" />
      </WidgetBoundary>
    </div>
  );
}
