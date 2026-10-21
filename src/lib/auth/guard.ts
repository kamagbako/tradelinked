import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Returns the signed-in user, or redirects. Also enforces the second factor:
 * a user who enabled 2FA but hasn't verified this session is sent to /login/mfa.
 * Call this from every protected page — layouts are not re-run on client navigation.
 */
export async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") redirect("/login/mfa");

  return { supabase, user };
}
