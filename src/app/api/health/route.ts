import { NextResponse } from "next/server";
import { getServiceRoleKey, getSupabaseEnv } from "@/lib/env";

// Always evaluated at request time so it reflects the environment the server is really running with.
export const dynamic = "force-dynamic";

type Check = { ok: boolean; detail?: string };

async function checkSupabase(url: string, anonKey: string): Promise<Check> {
  try {
    const response = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: anonKey },
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (response.ok) return { ok: true };
    return { ok: false, detail: `Supabase answered ${response.status} (check the URL and anon key).` };
  } catch {
    return { ok: false, detail: "Could not reach Supabase (check NEXT_PUBLIC_SUPABASE_URL)." };
  }
}

/**
 * Deployment self-check: GET /api/health. Reports which required settings are missing or invalid and
 * whether Supabase is reachable with the configured URL/key. Returns names and hints only, never values.
 */
export async function GET() {
  const checks: Record<string, Check> = {};

  let supabaseEnv: ReturnType<typeof getSupabaseEnv> | null = null;
  try {
    supabaseEnv = getSupabaseEnv();
    checks.supabaseConfig = { ok: true };
  } catch (error) {
    checks.supabaseConfig = { ok: false, detail: error instanceof Error ? error.message : "Invalid configuration." };
  }

  try {
    getServiceRoleKey();
    checks.serviceRoleKey = { ok: true };
  } catch (error) {
    checks.serviceRoleKey = { ok: false, detail: error instanceof Error ? error.message : "Missing." };
  }

  checks.supabaseReachable = supabaseEnv
    ? await checkSupabase(supabaseEnv.url, supabaseEnv.anonKey)
    : { ok: false, detail: "Skipped: Supabase is not configured." };

  // Email is optional: it only powers withdrawal notifications.
  checks.email = process.env.RESEND_API_KEY?.trim()
    ? { ok: true }
    : { ok: true, detail: "RESEND_API_KEY not set: notification emails are disabled." };

  const ok = Object.values(checks).every((check) => check.ok);
  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
