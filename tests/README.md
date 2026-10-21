# Tests

Vitest + React Testing Library. Run from the project root:

```bash
pnpm test            # whole suite, once
pnpm test:watch      # re-run on change
pnpm test:coverage   # coverage report in ./coverage
pnpm vitest run tests/components/dashboard   # just one section
```

## Layout

The folder mirrors `src/`, so a source file's test is easy to find:

| Source | Tests |
| --- | --- |
| `src/app/**/page.tsx`, `error.tsx`, `not-found.tsx` | `tests/app/**` |
| `src/components/<section>/Foo.tsx` | `tests/components/<section>/Foo.test.tsx` |
| `src/lib/**` (actions, auth, email, supabase, …) | `tests/lib/**` |
| `src/i18n/**` | `tests/i18n/` |
| `src/messages/**` (translation files) | `tests/messages/` |
| `src/middleware.ts` | `tests/middleware.test.ts` |

Sections under `tests/components/`: `admin`, `auth`, `dashboard`, `error`, `layout`, `marketing`, `motion`, `ui`.

- `tests/setup.ts` — global setup (jest-dom matchers, browser API stubs). Wired in `vitest.config.mts`.
- `tests/helpers/` — shared utilities:
  - `utils.tsx` — `renderWithIntl(ui, { locale })` (real next-intl provider + real message files) and
    `nextIntlServerMock()` for server actions/components.
  - `supabase.ts` — `createSupabaseMock()` / `createQueryBuilder()` and `RedirectSignal`.
  - `messages.ts` — `loadMessages(locale)` and `flatten()`.

## Conventions

- Name files `<Subject>.test.ts(x)`; put a test in the folder that matches the source file's section.
- Import the code under test with the `@/` alias (`@/components/ui/Button`) and helpers with `@tests/helpers/...`.
- Test behaviour through accessible queries (`getByRole`, `getByLabelText`), not implementation details.
- Cover the happy path, each validation branch, and the failure path (thrown errors should surface a friendly
  message, never a crash).
- No snapshots, no real network, no arbitrary sleeps — use fake timers where time matters.
- Test files are type-checked (`pnpm typecheck`) and linted (`pnpm lint`) like any other code.
