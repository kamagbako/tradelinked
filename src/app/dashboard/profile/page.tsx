import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProfileForm } from "@/components/dashboard/ProfileForm";
import { requireUser } from "@/lib/auth/guard";
import type { Profile } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard");
  return { title: t("nav.profile") };
}

export default async function ProfilePage() {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("dashboard");
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const profile = data as Profile | null;

  // Accounts created before first/last name existed only have a combined full_name.
  const [fallbackFirst = "", ...fallbackRest] = (profile?.full_name ?? "").split(" ");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-text">{t("profile.heading")}</h1>
      <ProfileForm
        values={{
          email: profile?.email ?? user.email ?? "",
          firstName: profile?.first_name ?? fallbackFirst,
          lastName: profile?.last_name ?? fallbackRest.join(" "),
          phone: profile?.phone ?? "",
          country: profile?.country ?? "",
          state: profile?.state ?? "",
          zipCode: profile?.zip_code ?? "",
          city: profile?.city ?? "",
          address: profile?.address ?? "",
        }}
      />
    </div>
  );
}
