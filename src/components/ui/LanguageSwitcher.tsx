"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Globe } from "lucide-react";
import { LOCALES } from "@/i18n/config";
import { setLocale } from "@/lib/actions/locale";
import { cn } from "@/lib/utils";

/** Dropdown for choosing the app language. Saves the choice in a cookie and re-renders the page. */
export function LanguageSwitcher({ className, align = "right" }: { className?: string; align?: "left" | "right" }) {
  const locale = useLocale();
  const t = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

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

  function choose(code: string) {
    setOpen(false);
    if (code === locale) return;
    startTransition(async () => {
      await setLocale(code);
      router.refresh();
    });
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t("languageLabel")}: ${current.name}`}
        className={cn(
          "flex min-h-[44px] items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium text-text hover:bg-hover",
          isPending && "opacity-60",
        )}
      >
        <Globe className="h-4 w-4 text-text-muted" />
        <span className="hidden sm:inline">{current.name}</span>
        <span className="sm:hidden">{current.short}</span>
        <ChevronDown className={cn("h-4 w-4 text-text-muted transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.25 }}
            className={cn(
              "absolute top-14 z-50 w-48 overflow-hidden rounded-2xl border border-border bg-surface p-1.5 shadow-xl",
              align === "right" ? "right-0" : "left-0",
            )}
          >
            {LOCALES.map((l) => (
              <li key={l.code} role="option" aria-selected={l.code === locale}>
                <button
                  type="button"
                  onClick={() => choose(l.code)}
                  className="flex min-h-[44px] w-full items-center justify-between rounded-xl px-3 text-sm text-text hover:bg-hover"
                >
                  {l.name}
                  {l.code === locale && <Check className="h-4 w-4 text-blue-500" />}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Flat list of language pills, for places a dropdown would be clipped (e.g. the mobile menu sheet). */
export function LanguagePills({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function choose(code: string) {
    if (code === locale) return;
    startTransition(async () => {
      await setLocale(code);
      router.refresh();
    });
  }

  return (
    <div className={cn("flex flex-wrap gap-2", isPending && "opacity-60", className)} role="group" aria-label={t("languageLabel")}>
      {LOCALES.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => choose(l.code)}
          aria-pressed={l.code === locale}
          className={cn(
            "min-h-[40px] rounded-full border px-4 text-sm font-medium transition-colors",
            l.code === locale ? "border-blue-500 bg-blue-500/15 text-blue-500" : "border-border text-text hover:bg-hover",
          )}
        >
          {l.name}
        </button>
      ))}
    </div>
  );
}
