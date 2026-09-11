/**
 * POST /api/checkout -- turns the caller's current cart into an order.
 * Guest checkout is allowed (see claude/project-status.md's "Cart &
 * Checkout" section) -- `customerId` is attached when the caller happens
 * to be signed in, but sign-in is never required.
 *
 * Body:
 *   customerName, customerEmail, customerPhone: string (required)
 *   shippingAddressLine1, shippingProvince: string (required)
 *   shippingWard, shippingDistrict, note: string (optional)
 *   paymentMethod: 'cod' | 'bank_transfer' (required)
 *
 * `?locale=vi|zh` selects the language order_items' product-name/variant-
 * label snapshot is captured in (see order-service.ts).
 */
export const prerender = false;

import type { APIRoute } from 'astro';
import { checkMethod, checkOrigin, jsonError } from '../../server/auth/csrf';
import { readCartId } from '../../server/commerce/cart-cookie';
import { placeOrder, OrderError } from '../../server/commerce/order-service';
import { getOptionalCustomerSession } from '../../server/commerce/customer-session';
import { isLocale, defaultLocale } from '../../i18n/utils';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requiredString(value: unknown, maxLength = 500): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) return null;
  return trimmed;
}

function optionalString(value: unknown, maxLength = 500): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : undefined;
}

function orderErrorStatus(code: OrderError['code']): number {
  return code === 'empty_cart' ? 409 : 409;
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
  const b = (body ?? {}) as Record<string, unknown>;

  const customerName = requiredString(b.customerName, 200);
  const customerEmailRaw = requiredString(b.customerEmail, 200);
  const customerPhone = requiredString(b.customerPhone, 40);
  const shippingAddressLine1 = requiredString(b.shippingAddressLine1, 400);
  const shippingProvince = requiredString(b.shippingProvince, 200);
  const paymentMethod = b.paymentMethod;

  if (!customerName) return jsonError(400, 'invalid_customer_name');
  if (!customerEmailRaw || !EMAIL_RE.test(customerEmailRaw)) return jsonError(400, 'invalid_customer_email');
  if (!customerPhone) return jsonError(400, 'invalid_customer_phone');
  if (!shippingAddressLine1) return jsonError(400, 'invalid_shipping_address');
  if (!shippingProvince) return jsonError(400, 'invalid_shipping_province');
  if (paymentMethod !== 'cod' && paymentMethod !== 'bank_transfer') return jsonError(400, 'invalid_payment_method');

  const localeParam = url.searchParams.get('locale');
  const locale = localeParam && isLocale(localeParam) ? localeParam : defaultLocale;

  const cartId = readCartId(cookies);
  if (!cartId) return jsonError(409, 'empty_cart');

  const session = await getOptionalCustomerSession(request);

  try {
    const result = await placeOrder({
      cartId,
      customerId: session?.id ?? null,
      locale,
      customerName,
      customerEmail: customerEmailRaw.toLowerCase(),
      customerPhone,
      shippingAddressLine1,
      shippingWard: optionalString(b.shippingWard, 200),
      shippingDistrict: optionalString(b.shippingDistrict, 200),
      shippingProvince,
      note: optionalString(b.note, 1000),
      paymentMethod,
    });
    return new Response(JSON.stringify(result), { status: 201, headers: { 'content-type': 'application/json' } });
  } catch (err) {
    if (err instanceof OrderError) {
      return new Response(
        JSON.stringify({ error: err.code, message: err.message, ...err.details }),
        { status: orderErrorStatus(err.code), headers: { 'content-type': 'application/json' } }
      );
    }
    console.error('Failed to place order:', err);
    return jsonError(500, 'Failed to place order.');
  }
};
