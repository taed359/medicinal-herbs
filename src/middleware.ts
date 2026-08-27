/**
 * Protects every /admin/* page and /api/admin/* route behind a valid
 * Better Auth session — Phase 1 (Admin Foundation). No role/RBAC check:
 * single-operator, "does a valid session exist" is the entire policy.
 *
 * /admin/login is the one admin-area path left public (you can't be
 * redirected to the login page *because* you're not logged in, and then
 * have the login page itself redirect you back).
 *
 * Storefront routes (/, /products/*, /vi/*, /zh/*, etc.) are untouched —
 * this middleware returns immediately via `next()` for anything outside
 * /admin and /api/admin, and those pages stay fully prerendered static
 * HTML; this middleware only actually executes for the on-demand routes.
 */
import { defineMiddleware } from 'astro:middleware';
import { auth } from './server/auth/auth';

const PUBLIC_ADMIN_PATHS = new Set(['/admin/login']);

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  const isAdminPage = pathname === '/admin' || pathname.startsWith('/admin/');
  const isAdminApi = pathname === '/api/admin' || pathname.startsWith('/api/admin/');

  if (!isAdminPage && !isAdminApi) {
    return next();
  }

  if (PUBLIC_ADMIN_PATHS.has(pathname)) {
    return next();
  }

  const session = await auth.api.getSession({ headers: context.request.headers });

  if (!session) {
    if (isAdminApi) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    }
    return context.redirect('/admin/login');
  }

  context.locals.adminUser = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  };

  return next();
});
