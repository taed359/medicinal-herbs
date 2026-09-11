/**
 * POST /api/cart/items -- add a variant to the cart (or increase its
 * quantity if already present). Body: { variantId: string, quantity?:
 * number } (quantity defaults to 1). `?locale=vi|zh` selects the returned
 * cart's display language.
 */
export const prerender = false;

import type { APIRoute } from 'astro';
import { checkMethod, checkOrigin, jsonError } from '../../../server/auth/csrf';
import { addItem, CartError } from '../../../server/commerce/cart-service';
import { getOptionalCustomerSession } from '../../../server/commerce/customer-session';
import { isLocale, defaultLocale } from '../../../i18n/utils';

function cartErrorStatus(code: CartError['code']): number {
  if (code === 'no_price' || code === 'insufficient_stock') return 409;
  if (code === 'not_found') return 404;
  return 400;
}

export const ALL: APIRoute = async ({ request, cookies, url }) => {
  const methodError = checkMethod(request, ['POST']);
  if (methodError) return methodError;
  const originError = checkOrigin(request);
  if (originError) return originError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'invalid_json');
  }

  const { variantId, quantity } = (body ?? {}) as { variantId?: unknown; quantity?: unknown };
  if (typeof variantId !== 'string' || variantId.length === 0) return jsonError(400, 'missing_variant_id');

  const qtyRaw = quantity === undefined ? 1 : Number(quantity);
  if (!Number.isFinite(qtyRaw)) return jsonError(400, 'invalid_quantity');

  const localeParam = url.searchParams.get('locale');
  const locale = localeParam && isLocale(localeParam) ? localeParam : defaultLocale;

  const session = await getOptionalCustomerSession(request);

  try {
    const cart = await addItem(cookies, session?.id ?? null, variantId, Math.trunc(qtyRaw), locale);
    return new Response(JSON.stringify(cart), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (err) {
    if (err instanceof CartError) {
      return new Response(
        JSON.stringify({ error: err.code, message: err.message, ...err.details }),
        { status: cartErrorStatus(err.code), headers: { 'content-type': 'application/json' } }
      );
    }
    console.error('Failed to add cart item:', err);
    return jsonError(500, 'Failed to add item to cart.');
  }
};
