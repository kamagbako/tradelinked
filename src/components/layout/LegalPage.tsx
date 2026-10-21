import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  const t = useTranslations("landing.legal");

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <Link href="/register" className="mb-6 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text">
          <ArrowLeft className="h-4 w-4" />
          {t("backToRegistration")}
        </Link>
        <h1 className="text-3xl font-bold text-text sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-text-muted">{t("lastUpdated", { updated })}</p>
        <div className="mt-8 flex flex-col gap-6 text-sm leading-relaxed text-text-muted [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-text">
          {children}
        </div>
      </main>
      <Footer />
    </>
  );
}
