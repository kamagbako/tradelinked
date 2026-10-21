import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getServiceRoleKey, getSupabaseEnv } from "@/lib/env";

export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();

  return createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — safe to ignore because
            // middleware refreshes the session on every request.
          }
        },
      },
    },
  );
}

/** Service-role client for privileged admin mutations. Server-only. */
export function createServiceClient() {
  return createSupabaseClient(
    getSupabaseEnv().url,
    getServiceRoleKey(),
    { auth: { persistSession: false } },
  );
}
