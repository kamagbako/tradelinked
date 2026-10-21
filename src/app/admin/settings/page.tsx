import type { Metadata } from "next";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { createClient } from "@/lib/supabase/server";
import type { CompanySettings } from "@/lib/types";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data: settings } = await supabase.from("company_settings").select("*").eq("id", 1).single();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-text">Company Settings</h1>
      <SettingsForm settings={settings as CompanySettings | null} />
    </div>
  );
}
