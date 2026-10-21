import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ChangePasswordForm } from "@/components/dashboard/ChangePasswordForm";
import { requireUser } from "@/lib/auth/guard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard");
  return { title: t("nav.changePassword") };
}

export default async function ChangePasswordPage() {
  await requireUser();
  const t = await getTranslations("dashboard");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-text">{t("nav.changePassword")}</h1>
      <ChangePasswordForm />
    </div>
  );
}
