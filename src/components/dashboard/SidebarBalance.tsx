"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { subscribeToTable } from "@/lib/supabase/realtime";
import { cn, formatCurrency } from "@/lib/utils";
import type { Balance } from "@/lib/types";

/** Live account balance. Also raises a browser notification when it changes, if the user allowed them. */
export function SidebarBalance({
  userId,
  initialBalance,
  className,
  compact = false,
}: {
  userId: string;
  initialBalance: number;
  className?: string;
  compact?: boolean;
}) {
  const t = useTranslations("dashboard");
  const [balance, setBalance] = useState(initialBalance);
  const previous = useRef(initialBalance);

  useEffect(() => {
    return subscribeToTable(`sidebar-balance-${userId}-${compact ? "m" : "d"}`, { event: "UPDATE", schema: "public", table: "balances", filter: `user_id=eq.${userId}` }, (payload) => {
          const next = Number((payload.new as Balance).available_balance);
          setBalance(next);

          if (!compact && next !== previous.current && typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification(t("sidebarBalance.notificationTitle"), {
              body: t("sidebarBalance.notificationBody", { amount: formatCurrency(next) }),
              icon: "/icons/icon-192.png",
            });
          }
          previous.current = next;
        });
  }, [userId, compact, t]);

  if (compact) {
    return (
      <span className={cn("rounded-full bg-hover px-3 py-1.5 text-sm font-semibold text-text", className)}>
        {formatCurrency(balance)}
      </span>
    );
  }

  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{t("sidebarBalance.accountBalance")}</p>
      <p className="mt-1 text-3xl font-bold text-blue-500">
        {balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        <span className="ml-1.5 text-sm font-semibold">USD</span>
      </p>
    </div>
  );
}
