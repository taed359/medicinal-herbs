/**
 * PATCH /api/cart/items/:itemId -- set a cart line's quantity. Body:
 * { quantity: number } (quantity <= 0 removes the line, same as DELETE).
 * DELETE /api/cart/items/:itemId -- remove a cart line outright.
 * `?locale=vi|zh` selects the returned cart's display language.
 */
export const prerender = false;

import type { APIRoute } from 'astro';
import { checkMethod, checkOrigin, jsonError } from '../../../../server/auth/csrf';
import { updateItemQuantity, removeItem, CartError } from '../../../../server/commerce/cart-service';
import { isLocale, defaultLocale } from '../../../../i18n/utils';

function cartErrorStatus(code: CartError['code']): number {
  if (code === 'no_price' || code === 'insufficient_stock') return 409;
  if (code === 'not_found') return 404;
  return 400;
}

export const ALL: APIRoute = async ({ request, cookies, url, params }) => {
  const methodError = checkMethod(request, ['PATCH', 'DELETE']);
  if (methodError) return methodError;
  const originError = checkOrigin(request);
  if (originError) return originError;

  const itemId = params.itemId;
  if (!itemId) return jsonError(400, 'missing_item_id');

  const localeParam = url.searchParams.get('locale');
  const locale = localeParam && isLocale(localeParam) ? localeParam : defaultLocale;

  try {
    if (request.method === 'DELETE') {
      const cart = await removeItem(cookies, itemId, locale);
      return new Response(JSON.stringify(cart), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError(400, 'invalid_json');
    }
    const { quantity } = (body ?? {}) as { quantity?: unknown };
    const qty = Number(quantity);
    if (!Number.isFinite(qty)) return jsonError(400, 'invalid_quantity');

    const cart = await updateItemQuantity(cookies, itemId, Math.trunc(qty), locale);
    return new Response(JSON.stringify(cart), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (err) {
    if (err instanceof CartError) {
      return new Response(
        JSON.stringify({ error: err.code, message: err.message, ...err.details }),
        { status: cartErrorStatus(err.code), headers: { 'content-type': 'application/json' } }
      );
    }
    console.error('Failed to update cart item:', err);
    return jsonError(500, 'Failed to update cart item.');
  }
};
