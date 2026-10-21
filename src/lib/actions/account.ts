"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { isStrongPassword } from "@/lib/validation";
import { runAction } from "@/lib/errors";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

async function updateProfileImpl(formData: FormData): Promise<ActionResult> {
  const t = await getTranslations("dashboard");
  const text = (key: string) => String(formData.get(key) ?? "").trim() || null;
  const firstName = text("firstName");
  const lastName = text("lastName");

  if (!firstName || !lastName) return { error: t("errors.namesRequired") };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: t("errors.signedIn") };

  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: firstName,
      last_name: lastName,
      full_name: `${firstName} ${lastName}`,
      phone: text("phone"),
      country: text("country"),
      state: text("state"),
      zip_code: text("zipCode"),
      city: text("city"),
      address: text("address"),
    })
    .eq("id", userData.user.id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard", "layout");
  return { success: true };
}

async function changePasswordImpl(formData: FormData): Promise<ActionResult> {
  const t = await getTranslations("dashboard");
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword) return { error: t("errors.currentPasswordRequired") };
  if (!isStrongPassword(newPassword)) {
    return { error: t("errors.passwordWeak") };
  }
  if (newPassword !== confirmPassword) return { error: t("errors.passwordMismatch") };
  if (newPassword === currentPassword) return { error: t("errors.passwordSame") };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user?.email) return { error: t("errors.signedIn") };

  // Re-verify the current password so a hijacked session can't silently change it.
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: userData.user.email,
    password: currentPassword,
  });
  if (verifyError) return { error: t("errors.currentPasswordIncorrect") };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: error.message };

  return { success: true };
}

export async function updateProfile(formData: FormData): Promise<ActionResult> {
  return runAction("account.updateProfile", () => updateProfileImpl(formData));
}

export async function changePassword(formData: FormData): Promise<ActionResult> {
  return runAction("account.changePassword", () => changePasswordImpl(formData));
}
