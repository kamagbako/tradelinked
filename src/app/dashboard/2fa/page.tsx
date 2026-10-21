import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TwoFactorSettings } from "@/components/dashboard/TwoFactorSettings";
import { requireUser } from "@/lib/auth/guard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard");
  return { title: t("nav.twoFactor") };
}

export default async function TwoFactorPage() {
  await requireUser();
  const t = await getTranslations("dashboard");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-text">{t("nav.twoFactor")}</h1>
      <TwoFactorSettings />
    </div>
  );
}
