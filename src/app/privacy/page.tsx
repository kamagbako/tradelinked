import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/layout/LegalPage";

const SECTIONS = ["collect", "use", "sharing", "rights"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing.legal.privacy");
  return { title: t("title") };
}

// DRAFT: placeholder copy — have qualified legal counsel review before launch.
export default async function PrivacyPage() {
  const t = await getTranslations("landing.legal");

  return (
    <LegalPage title={t("privacy.title")} updated={t("updated")}>
      {SECTIONS.map((id) => (
        <section key={id}>
          <h2>{t(`privacy.sections.${id}.heading`)}</h2>
          <p>{t(`privacy.sections.${id}.body`)}</p>
        </section>
      ))}
    </LegalPage>
  );
}
