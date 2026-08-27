/**
 * Origin/CSRF protection for /api/admin/* routes.
 *
 * The audit flagged this as NOT automatically covered by Better Auth for
 * *our own* routes: Better Auth validates Origin against its own
 * `trustedOrigins`/`baseURL` internally, but only for requests it handles
 * itself (everything under /api/auth/*). Every /api/admin/* route is our
 * own code and gets none of that for free — each mutating route must call
 * `checkOrigin` (and every route should call `checkMethod`) explicitly.
 *
 * Session validity is handled separately, by src/middleware.ts, before a
 * request ever reaches a route handler.
 */

const SITE_ORIGIN = (() => {
  const raw = process.env.BETTER_AUTH_URL;
  if (!raw) return undefined;
  try {
    return new URL(raw).origin;
  } catch {
    return undefined;
  }
})();

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function isMutatingMethod(method: string): boolean {
  return !SAFE_METHODS.has(method.toUpperCase());
}

export function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * Rejects any HTTP method not explicitly allowed for this route — call
 * this first in every /api/admin/* handler so an unexpected verb never
 * reaches route logic (and a GET route can never be asked to mutate
 * anything).
 */
export function checkMethod(request: Request, allowed: string[]): Response | null {
  if (!allowed.includes(request.method.toUpperCase())) {
    return jsonError(405, 'method_not_allowed');
  }
  return null;
}

/**
 * For any mutating method (anything but GET/HEAD/OPTIONS), requires the
 * Origin header to exactly match this deployment's own origin
 * (BETTER_AUTH_URL). Returns null (safe to proceed) for safe methods, or
 * when Origin matches. Fails closed — a missing/misconfigured
 * BETTER_AUTH_URL rejects every mutating request rather than silently
 * skipping the check.
 */
export function checkOrigin(request: Request): Response | null {
  if (!isMutatingMethod(request.method)) return null;

  if (!SITE_ORIGIN) {
    return jsonError(500, 'server_misconfigured');
  }

  const origin = request.headers.get('origin');
  if (!origin || origin !== SITE_ORIGIN) {
    return jsonError(403, 'invalid_origin');
  }

  return null;
}
