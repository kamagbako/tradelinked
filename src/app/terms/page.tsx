import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/layout/LegalPage";

const SECTIONS = ["acceptance", "account", "transactions", "restrictions", "changes"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing.legal.terms");
  return { title: t("title") };
}

// DRAFT: placeholder copy — have qualified legal counsel review before launch.
export default async function TermsPage() {
  const t = await getTranslations("landing.legal");

  return (
    <LegalPage title={t("terms.title")} updated={t("updated")}>
      {SECTIONS.map((id) => (
        <section key={id}>
          <h2>{t(`terms.sections.${id}.heading`)}</h2>
          <p>{t(`terms.sections.${id}.body`)}</p>
        </section>
      ))}
    </LegalPage>
  );
}
