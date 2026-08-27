/**
 * Better Auth catch-all handler. On-demand (not prerendered) — it has to
 * run per request to read/write the DB-backed session and to hash/verify
 * passwords. See astro.config.mjs for the adapter this requires.
 */
export const prerender = false;

import type { APIRoute } from 'astro';
import { auth } from '../../../server/auth/auth';

export const ALL: APIRoute = async ({ request }) => {
  return auth.handler(request);
};
