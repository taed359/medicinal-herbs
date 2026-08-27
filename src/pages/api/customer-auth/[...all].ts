/**
 * Customer Better Auth catch-all handler. Mirrors src/pages/api/auth/
 * [...all].ts exactly, pointed at the customer instance instead of admin.
 * On-demand (not prerendered) for the same reason: it reads/writes the
 * DB-backed session and hashes/verifies passwords per request.
 */
export const prerender = false;

import type { APIRoute } from 'astro';
import { customerAuth } from '../../../server/auth/customer-auth';

export const ALL: APIRoute = async ({ request }) => {
  return customerAuth.handler(request);
};
