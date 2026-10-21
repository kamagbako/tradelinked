"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, TrendingUp, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const links = [
  { href: "/#about", key: "about" },
  { href: "/#how-it-works", key: "howItWorks" },
  { href: "/#plans", key: "plans" },
  { href: "/#payments", key: "payments" },
  { href: "/#security", key: "security" },
] as const;

export function Navbar() {
  const t = useTranslations("landing.nav");
  const [open, setOpen] = useState(false);

  return (
    <motion.header
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-md"
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold text-text">
          <TrendingUp className="h-6 w-6 text-emerald-500" />
          TradeLinked
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="text-sm text-text-muted hover:text-text">
              {t(link.key)}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <LanguageSwitcher />
          <ThemeToggle />
          <Link href="/login">
            <Button variant="ghost" size="sm">{t("logIn")}</Button>
          </Link>
          <Link href="/register">
            <Button variant="primary" size="sm">{t("getStarted")}</Button>
          </Link>
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <LanguageSwitcher />
          <ThemeToggle />
          <button
            className="flex h-11 w-11 items-center justify-center text-text"
            onClick={() => setOpen((v) => !v)}
            aria-label={t("toggleMenu")}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
        <motion.div
          key="mobile-menu"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.45, ease: "easeInOut" }}
          className="overflow-hidden border-t border-border px-4 md:hidden"
        >
          <div className="flex flex-col gap-3 py-4">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="min-h-[44px] py-2 text-sm text-text-muted hover:text-text"
              >
                {t(link.key)}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2">
              <Link href="/login" onClick={() => setOpen(false)}>
                <Button variant="secondary" className="w-full">{t("logIn")}</Button>
              </Link>
              <Link href="/register" onClick={() => setOpen(false)}>
                <Button variant="primary" className="w-full">{t("getStarted")}</Button>
              </Link>
            </div>
          </div>
        </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
