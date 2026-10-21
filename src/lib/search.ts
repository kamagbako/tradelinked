/**
 * Makes free text safe to interpolate into a PostgREST `.or()` / `.ilike` filter string.
 * Commas and parentheses delimit filter clauses, so a raw search like `a,role.eq.ADMIN` could otherwise
 * inject extra conditions; wildcards and quotes/backslashes are stripped too.
 */
export function sanitizeSearchTerm(input: string | null | undefined): string {
  return (input ?? "").replace(/[,()%*_\\"'`]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}
