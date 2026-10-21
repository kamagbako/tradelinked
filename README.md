# TradeLinked

Mobile-first trading & investment portal built with Next.js 15 (App Router), TypeScript,
Tailwind CSS v4, Supabase, and Resend.

## Setup

1. **Install dependencies** (requires Node.js 18.18+ — this environment's shell had no
   Node/npm on its PATH, so this step needs to be run from a terminal that has them):

   ```bash
   npm install
   ```

2. **Create a Supabase project**, then run [`supabase/schema.sql`](supabase/schema.sql) in the
   SQL editor (or `supabase db push`). It creates all tables, RLS policies, the
   `apply_ledger_entry` / `request_withdrawal` / `resolve_withdrawal` RPCs, and enables
   Realtime on `balances` and `ledger_entries`.

3. **Create your first admin user**: register normally through `/register`, then in the
   Supabase SQL editor run:

   ```sql
   update profiles set role = 'ADMIN' where email = 'you@example.com';
   ```

4. **Copy environment variables**:

   ```bash
   cp .env.example .env.local
   ```

   Fill in your Supabase URL/keys, a [Resend](https://resend.com) API key + verified sender,
   and your WhatsApp support link.

5. **Run the dev server**:

   ```bash
   npm run dev
   ```

## Notes

- PWA support (via `@ducanh2912/next-pwa`) is disabled in development and active in
  production builds (`npm run build && npm run start`).
- `public/icons/icon-192.png` and `icon-512.png` are generated placeholders — swap them for
  real branded artwork before shipping.
- The manual ledger and withdrawal-resolution RPCs (`apply_ledger_entry`,
  `resolve_withdrawal`) lock the relevant `balances` row for the transaction's duration,
  which is what prevents a double-click (or a race between two admins) from double-applying
  the same entry.

## Admin access

There is no admin sign-up. Register a normal account, then promote it in the Supabase SQL editor:

```sql
update profiles set role = 'ADMIN' where email = 'you@example.com';
```

Log out and back in. An **Admin panel** link now appears in the sidebar (and avatar menu / mobile More sheet);
you can also go straight to `/admin`.

## Database migrations

Run in the Supabase SQL editor, in order: `supabase/schema.sql`, then everything in `supabase/migrations/`.

## Deposits (Bitcoin-only)

Deposits only accept Bitcoin. The receiving address, the processing fee (flat + percentage) and the
min/max deposit amount are stored in `company_settings`, not in code or `.env` — change them any time
at **`/admin/settings`**, no redeploy needed. `004_btc_only_deposits.sql` seeds a starting BTC address;
replace it with your own from the admin page before going live. Bank transfer and USDT fields are kept
in the schema and admin form in case you re-enable those methods later, but the Deposit page itself only
ever shows Bitcoin.

## Languages

English, Français, Español, Português, Deutsch and 中文. Strings live in `src/messages/<code>/*.json`.
To add a language, add it to `src/i18n/config.ts` and copy `src/messages/en/` to `src/messages/<code>/`
(missing keys fall back to English). The admin panel is English-only.

## Testing

```bash
pnpm test            # run the whole suite once
pnpm test:watch      # re-run on change
pnpm test:coverage   # with a coverage report (./coverage)
pnpm typecheck && pnpm lint
```

Tests use Vitest + React Testing Library and all live in the top-level [`tests/`](tests) folder, which mirrors
`src/` by section (`tests/components/dashboard`, `tests/lib/actions`, `tests/app/admin`, …).
Shared helpers are in `tests/helpers/` (import them via the `@tests/helpers/*` alias): `renderWithIntl` (real
translations), `createSupabaseMock` (chainable Supabase double) and `nextIntlServerMock` (for server actions).
See [tests/README.md](tests/README.md) for conventions. CI runs lint, typecheck, tests and a production build on
every pull request.

## Error handling

- **Route boundaries:** `app/error.tsx`, `app/dashboard/error.tsx`, `app/admin/error.tsx`, `app/global-error.tsx`
  and `app/not-found.tsx` show a translated recovery screen instead of a blank page.
- **Widget boundaries:** `WidgetBoundary` isolates charts, the ticker and the chat bubble, so one failing
  widget can't take down the page.
- **Server actions:** every action goes through `runAction` (`src/lib/errors.ts`): unexpected failures become a
  friendly translated `{ error }`, while `redirect()`/`notFound()` still work.
- **Logging:** everything reports through `src/lib/logger.ts` — plug an error tracker in there.
- **Config:** missing Supabase env vars raise a clear `MissingEnvError`; notification emails are best-effort
  and never fail a withdrawal.

## Deploying (Vercel)

`.env.local` is git-ignored, so **it is not deployed**. Add these in *Project → Settings → Environment Variables*
(Production, and Preview if you use it), then **redeploy** — `NEXT_PUBLIC_*` values are baked in at build time,
so changing them requires a new build:

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Full URL, e.g. `https://xyz.supabase.co` (include `https://`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Secret; server-only |
| `NEXT_PUBLIC_SITE_URL` | no | Public origin; falls back to the Vercel domain |
| `NEXT_PUBLIC_WHATSAPP_SUPPORT_URL` | no | Used by the chat assistant |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ADMIN_NOTIFICATION_EMAIL` | no | Withdrawal notification emails |

After deploying, open **`/api/health`**: it lists any missing or invalid variable by name and checks that Supabase
is reachable (it never prints secret values). Also run the SQL in `supabase/` (schema + migrations) on your
Supabase project, and set the Supabase *Auth → URL Configuration* site URL to your deployed domain.

