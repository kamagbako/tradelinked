export class MissingEnvError extends Error {
  constructor(names: string[]) {
    super(
      `Missing environment variable${names.length > 1 ? "s" : ""}: ${names.join(", ")}. ` +
        "Copy .env.example to .env.local (or add them in your hosting dashboard, then redeploy) " +
        "and fill in your Supabase project values.",
    );
    this.name = "MissingEnvError";
  }
}

export class InvalidEnvError extends Error {
  constructor(name: string, expectation: string) {
    super(`Invalid environment variable ${name}: ${expectation}`);
    this.name = "InvalidEnvError";
  }
}

/** Values pasted into hosting dashboards often carry a stray space/newline, which breaks HTTP headers. */
function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

function assertHttpUrl(name: string, value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new InvalidEnvError(name, "must be a full URL such as https://your-project.supabase.co (include https://).");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new InvalidEnvError(name, "must start with https:// (or http:// for local development).");
  }
}

/** Public Supabase settings. Throws a clear, actionable error instead of an opaque client failure. */
export function getSupabaseEnv() {
  // Referenced literally so Next.js can inline NEXT_PUBLIC_* values into the browser bundle.
  const url = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const missing = [
    !url && "NEXT_PUBLIC_SUPABASE_URL",
    !anonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ].filter(Boolean) as string[];
  if (missing.length > 0) throw new MissingEnvError(missing);

  assertHttpUrl("NEXT_PUBLIC_SUPABASE_URL", url);
  return { url, anonKey };
}

export function getServiceRoleKey() {
  const key = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!key) throw new MissingEnvError(["SUPABASE_SERVICE_ROLE_KEY"]);
  return key;
}

const LOCAL_SITE_URL = "http://localhost:3000";

/**
 * The public origin of the site (used for canonical/OpenGraph URLs, sitemap, robots).
 * Never throws: a missing, empty or scheme-less NEXT_PUBLIC_SITE_URL is repaired, and on Vercel it falls back
 * to the deployment's own domain instead of localhost.
 */
export function getSiteUrl(): string {
  const candidates = [
    clean(process.env.NEXT_PUBLIC_SITE_URL),
    clean(process.env.VERCEL_PROJECT_PRODUCTION_URL),
    clean(process.env.VERCEL_URL),
  ];

  for (const raw of candidates) {
    if (!raw) continue;
    try {
      return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).origin;
    } catch {
      // try the next candidate
    }
  }
  return LOCAL_SITE_URL;
}
