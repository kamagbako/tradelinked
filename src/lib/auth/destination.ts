/**
 * Where a signed-in user should land, given their profile role: admins go straight to the admin
 * panel instead of the regular dashboard. Callers fetch the role themselves (same one-line
 * `profiles` query already used elsewhere, e.g. the admin route gate in supabase/middleware.ts) —
 * kept out of this function so it stays a plain, trivially-testable decision and doesn't need a
 * Supabase client typed to satisfy every caller's runtime (server, browser, middleware).
 *
 * Used right after sign-in (and after the 2FA challenge, if any) — not on every navigation, so an
 * admin can still browse the user-facing dashboard afterward.
 */
export function postLoginDestination(role: string | null | undefined): "/admin" | "/dashboard" {
  return role === "ADMIN" ? "/admin" : "/dashboard";
}
