/**
 * Validates a client-supplied redirect target (e.g. `/customer/login
 * ?redirect=...`) against open-redirect abuse.
 *
 * Deliberately NOT a `startsWith('/')` check -- that accepts protocol-
 * relative URLs (`//evil.com`, which browsers treat as same-scheme,
 * different-host) and backslash tricks (`/\evil.com`, which the WHATWG URL
 * parser normalizes to a forward slash for http(s) *before* resolving,
 * landing on evil.com's origin). Instead: parse the candidate against a
 * fixed, unrelated dummy origin and require the parsed result to still
 * resolve to that exact dummy origin. Anything that carries its own
 * scheme/host -- absolute URLs, protocol-relative URLs, backslash
 * variants, `javascript:`/`data:`/`mailto:` -- changes the resolved
 * origin (or fails to parse) and is rejected by this one comparison,
 * with no scheme-specific string matching needed.
 *
 * The validated target is always reconstructed from the parsed URL
 * object's own pathname/search/hash -- never the caller's raw string --
 * so a parser-differential between this validation and whatever finally
 * consumes the redirect can never matter.
 */

const DUMMY_ORIGIN = 'https://internal.invalid';

export function resolveSafeRedirect(candidate: string | null | undefined, fallback: string): string {
  if (!candidate) return fallback;

  let parsed: URL;
  try {
    parsed = new URL(candidate, DUMMY_ORIGIN);
  } catch {
    return fallback;
  }

  if (parsed.origin !== DUMMY_ORIGIN) return fallback;

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
