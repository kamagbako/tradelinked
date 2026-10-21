import { vi } from "vitest";

type Result = { data?: unknown; error?: { message: string } | null; count?: number | null };

/**
 * Chainable, awaitable stand-in for a Supabase query builder.
 * Every filter/modifier returns the builder itself; awaiting it (or calling .single()/.maybeSingle())
 * resolves to the configured result. Inspect `calls` to assert what was queried.
 */
export function createQueryBuilder(result: Result = { data: null, error: null }) {
  const calls: { method: string; args: unknown[] }[] = [];
  const resolved = { data: null, error: null, ...result };

  const builder: Record<string, unknown> = {};
  const chain = [
    "select", "insert", "update", "upsert", "delete", "eq", "neq", "in", "is", "gt", "gte", "lt", "lte",
    "like", "ilike", "or", "not", "order", "limit", "range", "match", "filter", "contains",
  ];
  for (const method of chain) {
    builder[method] = vi.fn((...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    });
  }
  builder.single = vi.fn(async () => resolved);
  builder.maybeSingle = vi.fn(async () => resolved);
  builder.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(resolved).then(onFulfilled, onRejected);

  return Object.assign(builder, { calls });
}

export interface SupabaseMockOptions {
  user?: { id: string; email?: string } | null;
  /** Results keyed by table name. */
  tables?: Record<string, Result>;
  /** Results keyed by RPC name. */
  rpc?: Record<string, Result>;
  aal?: { currentLevel: string; nextLevel: string } | null;
  factors?: { totp?: { id: string; status?: string }[]; all?: { id: string; status: string }[] };
  authError?: { message: string } | null;
}

/**
 * Minimal Supabase client double covering what the app uses: auth (getUser, signIn/Up/Out, updateUser,
 * mfa.*), from(table), and rpc(name). Returned `client` is a plain object of vi.fn()s so tests can
 * override individual methods.
 */
export function createSupabaseMock(options: SupabaseMockOptions = {}) {
  const { user = { id: "user-1", email: "user@example.com" }, tables = {}, rpc = {}, aal = null } = options;

  const builders: Record<string, ReturnType<typeof createQueryBuilder>> = {};

  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user }, error: options.authError ?? null })),
      // Real Supabase always returns the signed-in user alongside a successful sign-in/verify.
      signInWithPassword: vi.fn(async () => ({ data: { user, session: {} }, error: options.authError ?? null })),
      signUp: vi.fn(async () => ({ data: { user, session: {} }, error: options.authError ?? null })),
      signOut: vi.fn(async () => ({ error: null })),
      updateUser: vi.fn(async () => ({ data: {}, error: null })),
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn(async () => ({ data: aal, error: null })),
        listFactors: vi.fn(async () => ({
          data: { totp: options.factors?.totp ?? [], all: options.factors?.all ?? options.factors?.totp ?? [] },
          error: null,
        })),
        enroll: vi.fn(async () => ({
          data: { id: "factor-1", totp: { qr_code: "data:image/svg+xml;base64,AAA", secret: "SECRET123" } },
          error: null,
        })),
        challengeAndVerify: vi.fn(async () => ({ data: { user, access_token: "token" }, error: null })),
        unenroll: vi.fn(async () => ({ data: {}, error: null })),
      },
    },
    from: vi.fn((table: string) => (builders[table] ??= createQueryBuilder(tables[table]))),
    rpc: vi.fn(async (name: string) => ({ data: null, error: null, ...rpc[name] })),
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() })),
    removeChannel: vi.fn(),
  };

  return { client, builders };
}

/** An error shaped like the ones Next.js throws from redirect(), so tests can assert redirects. */
export class RedirectSignal extends Error {
  digest: string;
  constructor(public url: string) {
    super("NEXT_REDIRECT");
    this.digest = `NEXT_REDIRECT;replace;${url};307;`;
  }
}
