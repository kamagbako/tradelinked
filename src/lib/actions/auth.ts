"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { isStrongPassword, isValidEmail } from "@/lib/validation";
import { runAction } from "@/lib/errors";
import { logError } from "@/lib/logger";
import { postLoginDestination } from "@/lib/auth/destination";

export interface ActionResult {
  error?: string;
}

async function signInImpl(formData: FormData): Promise<ActionResult> {
  const t = await getTranslations("auth.errors");
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: t("credentialsRequired") };
  }

  const supabase = await createClient();
  const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    redirect("/login/mfa");
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", signInData.user.id).single();
  redirect(postLoginDestination(profile?.role));
}

async function signUpImpl(formData: FormData): Promise<ActionResult> {
  const t = await getTranslations("auth.errors");
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const acceptedTerms = formData.get("acceptTerms") === "on";

  if (!fullName) {
    return { error: t("fullNameRequired") };
  }
  if (!isValidEmail(email)) {
    return { error: t("invalidEmail") };
  }
  if (!isStrongPassword(password)) {
    return { error: t("weakPassword") };
  }
  if (password !== confirmPassword) {
    return { error: t("passwordsMismatch") };
  }
  if (!acceptedTerms) {
    return { error: t("termsRequired") };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}

export async function signOut() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (error) {
    // Even if the auth server is unreachable, send the user to the login page.
    logError("action:auth.signOut", error);
  }
  redirect("/login");
}

export async function signIn(formData: FormData): Promise<ActionResult> {
  return runAction("auth.signIn", () => signInImpl(formData));
}

export async function signUp(formData: FormData): Promise<ActionResult> {
  return runAction("auth.signUp", () => signUpImpl(formData));
}
