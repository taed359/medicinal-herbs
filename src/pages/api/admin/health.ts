/**
 * /api/admin/* skeleton placeholder — Phase 1. Product CRUD (Phase 2)
 * will add real routes alongside this one; this exists only to prove out
 * the protection pattern every future /api/admin/* route must follow:
 * session check (src/middleware.ts, already applied before this file
 * runs), method allow-list, and origin validation on any mutating verb.
 *
 * GET-only and side-effect-free on purpose — a health check must never
 * mutate state.
 */
export const prerender = false;

import type { APIRoute } from 'astro';
import { checkMethod, checkOrigin } from '../../../server/auth/csrf';

export const ALL: APIRoute = async ({ request, locals }) => {
  const methodError = checkMethod(request, ['GET']);
  if (methodError) return methodError;

  // No-op for GET (checkOrigin only enforces on mutating methods) — kept
  // here so this route is a template every real /api/admin/* mutation
  // route can copy verbatim.
  const originError = checkOrigin(request);
  if (originError) return originError;

  return new Response(
    JSON.stringify({
      status: 'ok',
      adminUser: locals.adminUser?.email ?? null,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
};
