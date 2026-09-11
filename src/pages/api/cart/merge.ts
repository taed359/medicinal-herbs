/**
 * POST /api/cart/merge -- called once, right after a successful customer
 * sign-in (see src/pages/customer/login.astro), to reconcile a guest cart
 * built up before login with the customer's own cart. No-op (204) if the
 * caller isn't actually signed in -- this route is only ever meaningful
 * immediately after a sign-in response succeeds, but it's harmless to call
 * defensively. See cart-service.ts's mergeCartOnLogin for the merge rules.
 */
export const prerender = false;

import type { APIRoute } from 'astro';
import { checkMethod, checkOrigin } from '../../../server/auth/csrf';
import { mergeCartOnLogin } from '../../../server/commerce/cart-service';
import { getOptionalCustomerSession } from '../../../server/commerce/customer-session';

export const ALL: APIRoute = async ({ request, cookies }) => {
  const methodError = checkMethod(request, ['POST']);
  if (methodError) return methodError;
  const originError = checkOrigin(request);
  if (originError) return originError;

  const session = await getOptionalCustomerSession(request);
  if (!session) return new Response(null, { status: 204 });

  try {
    await mergeCartOnLogin(cookies, session.id);
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error('Failed to merge cart on login:', err);
    // Never block a successful login on a cart-merge failure -- the guest
    // cart cookie simply stays as-is (still usable, just not yet attached
    // to the account) rather than surfacing an error to a visitor who
    // just successfully signed in.
    return new Response(null, { status: 204 });
  }
};
