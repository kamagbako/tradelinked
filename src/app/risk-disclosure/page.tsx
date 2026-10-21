import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/layout/LegalPage";

const SECTIONS = ["highRisk", "noGuarantee", "affordToLose", "marketRisk"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing.legal.risk");
  return { title: t("title") };
}

// DRAFT: placeholder copy — have qualified legal counsel review before launch.
export default async function RiskDisclosurePage() {
  const t = await getTranslations("landing.legal");

  return (
    <LegalPage title={t("risk.title")} updated={t("updated")}>
      {SECTIONS.map((id) => (
        <section key={id}>
          <h2>{t(`risk.sections.${id}.heading`)}</h2>
          <p>{t(`risk.sections.${id}.body`)}</p>
        </section>
      ))}
    </LegalPage>
  );
}
