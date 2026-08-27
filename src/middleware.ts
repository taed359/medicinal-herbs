/**
 * Two independent auth gates in one middleware:
 *   - /admin/* + /api/admin/*      -> src/server/auth/auth.ts (admin)
 *   - /customer/* + /api/customer-auth/* -> src/server/auth/customer-auth.ts
 *
 * The two never share a session table, a cookie, or a code path — see
 * src/db/schema.ts's customer_* doc comment for why. This file only
 * decides "is there a valid session for the right instance"; it never
 * reads the other instance's tables.
 *
 * /admin/login and /customer/{login,register,verify-email,forgot-password,
 * reset-password} are the public entry points of each area — you can't be
 * redirected to a login page *because* you're not logged in, and then have
 * that same login page redirect you back. /api/customer-auth/* is Better
 * Auth's own instance handling its own internal logic (sign-in, sign-up,
 * sign-out, get-session, verify-email, reset-password) — mirrors how
 * /api/auth/* (admin's equivalent) is never session-gated by this
 * middleware either; only /customer/* pages need a locals.customerUser
 * populated.
 *
 * SESSION-FAILURE SEMANTICS (critical, applies to both instances):
 * `getSession()` resolving to `null` (no cookie / expired / revoked) and
 * `getSession()` THROWING (DB/auth-infrastructure failure) are different
 * conditions and must never be collapsed into one. Verified directly
 * against the installed better-auth@1.7.2 source
 * (dist/api/routes/session.mjs + dist/api/index.mjs: `auth.api.getSession`
 * is wired to the raw `/get-session` endpoint, not the error-swallowing
 * `getSessionFromCtx` internal helper other Better Auth code uses
 * internally) — no session cookie resolves to a clean `null` inside the
 * endpoint's own try block; a DB error during the session lookup is
 * caught and re-thrown as a real `APIError`. So: `null` -> normal
 * unauthenticated handling (redirect/401); a thrown error -> a controlled
 * 503, NEVER a redirect to login and NEVER treated as "logged out" (that
 * would misreport a real outage as a normal auth state to both the user
 * and to whatever's watching error rates).
 *
 * Every response in either protected branch also gets `Cache-Control:
 * no-store` (see `withNoStore` below) — the already-proven fix for the
 * admin bfcache-after-logout issue, applied identically to the customer
 * area's auth/account pages so the same class of bug can't recur there.
 * Storefront routes (/, /products/*, /vi/*, /zh/*, etc.) are completely
 * untouched — this middleware returns immediately via `next()` for
 * anything outside the four prefixes above, and those pages keep their
 * normal cache-friendly headers.
 */
import { defineMiddleware } from 'astro:middleware';
import { auth } from './server/auth/auth';
import { customerAuth } from './server/auth/customer-auth';

const PUBLIC_ADMIN_PATHS = new Set(['/admin/login']);

function withNoStore(response: Response): Response {
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

/** A generic, non-leaking "the backend is temporarily unavailable"
 *  response — used whenever a session lookup throws rather than resolves,
 *  for either auth instance. Never includes the underlying error message
 *  (which could contain connection strings, driver internals, etc.). */
function serviceUnavailable(asJson: boolean): Response {
  if (asJson) {
    return new Response(JSON.stringify({ error: 'temporarily_unavailable' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    });
  }
  return new Response('Temporarily unavailable. Please try again shortly.', {
    status: 503,
    headers: { 'content-type': 'text/plain' },
  });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  const isAdminPage = pathname === '/admin' || pathname.startsWith('/admin/');
  const isAdminApi = pathname === '/api/admin' || pathname.startsWith('/api/admin/');
  const isCustomerAuthApi = pathname === '/api/customer-auth' || pathname.startsWith('/api/customer-auth/');
  const isCustomerPage = pathname === '/customer' || pathname.startsWith('/customer/');

  if (isCustomerAuthApi) {
    // Better Auth's own instance handles its own session/CSRF/rate-limit
    // logic internally for every one of its routes (sign-in, sign-up,
    // sign-out, get-session, verify-email, reset-password, ...) -- this
    // middleware only adds the no-store header, exactly as /api/auth/*
    // (admin's equivalent) is never session-gated here either.
    return withNoStore(await next());
  }

  if (isCustomerPage) {
    // No /customer/* page requires a session to view in this phase (there
    // is no protected /customer/account yet — every current page is an
    // auth entry point: login/register/verify-email/forgot-password/
    // reset-password). The session is still resolved once, here, and
    // exposed via locals so any current page (e.g. login/register bouncing
    // an already-authenticated visitor) or a future protected page reads
    // it from locals instead of calling getSession itself (§26: never call
    // getSession more than once per request). A future protected page adds
    // its own `if (!context.locals.customerUser) return redirect(...)`
    // check, the same way each admin page already does today.
    let session: Awaited<ReturnType<typeof customerAuth.api.getSession>>;
    try {
      session = await customerAuth.api.getSession({ headers: context.request.headers });
    } catch {
      return withNoStore(serviceUnavailable(false));
    }
    if (session) {
      context.locals.customerUser = {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        emailVerified: session.user.emailVerified,
      };
    }
    return withNoStore(await next());
  }

  if (!isAdminPage && !isAdminApi) {
    return next();
  }

  if (PUBLIC_ADMIN_PATHS.has(pathname)) {
    return withNoStore(await next());
  }

  let session: Awaited<ReturnType<typeof auth.api.getSession>>;
  try {
    session = await auth.api.getSession({ headers: context.request.headers });
  } catch {
    return withNoStore(serviceUnavailable(isAdminApi));
  }

  if (!session) {
    if (isAdminApi) {
      return withNoStore(
        new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        })
      );
    }
    return withNoStore(context.redirect('/admin/login'));
  }

  context.locals.adminUser = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  };

  return withNoStore(await next());
});
