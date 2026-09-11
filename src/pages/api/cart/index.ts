/**
 * GET /api/cart -- current cart contents (drawer + header badge + full
 * cart page all call this). `?locale=vi|zh` selects display language;
 * defaults to 'vi' if missing/invalid, same fallback as getTranslations.
 *
 * Never creates a cart row -- a visitor who hasn't added anything gets
 * the empty-cart shape without touching the DB (see cart-service.ts's
 * getCart).
 */
export const prerender = false;

import type { APIRoute } from 'astro';
import { checkMethod, checkOrigin, jsonError } from '../../../server/auth/csrf';
import { getCart } from '../../../server/commerce/cart-service';
import { isLocale, defaultLocale } from '../../../i18n/utils';

export const ALL: APIRoute = async ({ request, cookies, url }) => {
  const methodError = checkMethod(request, ['GET']);
  if (methodError) return methodError;
  const originError = checkOrigin(request);
  if (originError) return originError;

  const localeParam = url.searchParams.get('locale');
  const locale = localeParam && isLocale(localeParam) ? localeParam : defaultLocale;

  try {
    const cart = await getCart(cookies, locale);
    return new Response(JSON.stringify(cart), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (err) {
    console.error('Failed to load cart:', err);
    return jsonError(500, 'Failed to load cart.');
  }
};
