"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { KeyRound, LogOut, ShieldCheck, User } from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { initialsOf } from "@/components/dashboard/nav";

export function AvatarMenu({ name, email, isAdmin = false }: { name: string | null; email: string; isAdmin?: boolean }) {
  const t = useTranslations("dashboard");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <motion.button
        type="button"
        whileTap={{ scale: 0.92 }}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("avatarMenu.accountMenu")}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-500 text-sm font-bold text-white"
      >
        {initialsOf(name, email)}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.25 }}
            style={{ transformOrigin: "top right" }}
            className="absolute right-0 top-14 z-50 w-60 overflow-hidden rounded-2xl border border-border bg-surface shadow-xl"
          >
            <div className="border-b border-border px-4 py-3">
              <p className="truncate text-sm font-semibold text-text">{name || t("avatarMenu.yourAccount")}</p>
              <p className="truncate text-xs text-text-muted">{email}</p>
            </div>
            <div className="flex flex-col p-1.5">
              <Link href="/dashboard/profile" onClick={() => setOpen(false)} role="menuitem" className="flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm text-text hover:bg-hover">
                <User className="h-4 w-4 text-text-muted" /> {t("avatarMenu.profile")}
              </Link>
              <Link href="/dashboard/change-password" onClick={() => setOpen(false)} role="menuitem" className="flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm text-text hover:bg-hover">
                <KeyRound className="h-4 w-4 text-text-muted" /> {t("avatarMenu.changePassword")}
              </Link>
              {isAdmin && (
                <Link href="/admin" onClick={() => setOpen(false)} role="menuitem" className="flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm text-amber-500 hover:bg-hover">
                  <ShieldCheck className="h-4 w-4" /> {t("avatarMenu.adminPanel")}
                </Link>
              )}
              <form action={signOut}>
                <button type="submit" role="menuitem" className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-sm text-red-400 hover:bg-hover">
                  <LogOut className="h-4 w-4" /> {t("avatarMenu.logOut")}
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
