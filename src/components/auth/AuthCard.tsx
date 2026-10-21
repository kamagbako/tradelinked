import Link from "next/link";
import { TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { Reveal } from "@/components/motion/Reveal";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-bg px-4 py-12">
      <div className="absolute right-4 top-4 flex items-center gap-1">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
      <Link href="/" className="mb-8 flex items-center gap-2 font-semibold text-text">
        <TrendingUp className="h-6 w-6 text-emerald-500" />
        TradeLinked
      </Link>

      <Reveal y={20} className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <h1 className="text-xl font-semibold text-text">{title}</h1>
        <p className="mt-1 text-sm text-text-muted">{subtitle}</p>

        <div className="mt-6">{children}</div>

        {/* A <div>, not a <p>: footers can contain block content such as a <form> (see the MFA page). */}
        <div className="mt-6 text-center text-sm text-text-muted">{footer}</div>
      </Reveal>
    </div>
  );
}
