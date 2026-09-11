/**
 * GET /api/orders/:orderNumber?email=... -- order recap for the
 * confirmation page. Requires the email to match the order's own
 * customerEmail (see order-service.ts's getOrderByNumberForEmail) --
 * an order number alone must never be enough to pull someone else's
 * name/address/phone.
 */
export const prerender = false;

import type { APIRoute } from 'astro';
import { checkMethod, checkOrigin, jsonError } from '../../../server/auth/csrf';
import { getOrderByNumberForEmail } from '../../../server/commerce/order-service';

export const ALL: APIRoute = async ({ request, url, params }) => {
  const methodError = checkMethod(request, ['GET']);
  if (methodError) return methodError;
  const originError = checkOrigin(request);
  if (originError) return originError;

  const orderNumber = params.orderNumber;
  const email = url.searchParams.get('email');
  if (!orderNumber || !email) return jsonError(400, 'missing_params');

  try {
    const order = await getOrderByNumberForEmail(orderNumber, email);
    if (!order) return jsonError(404, 'order_not_found');
    return new Response(JSON.stringify(order), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (err) {
    console.error(`Failed to load order "${orderNumber}":`, err);
    return jsonError(500, 'Failed to load order.');
  }
};
