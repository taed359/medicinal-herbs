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
import { sql } from 'drizzle-orm';
import { db } from '../../server/db/client';
import { checkoutAttempts } from '../../db/schema';
import { checkMethod, checkOrigin, jsonError } from '../../server/auth/csrf';
import { readCartId } from '../../server/commerce/cart-cookie';
import { placeOrder, OrderError } from '../../server/commerce/order-service';
import { getOptionalCustomerSession } from '../../server/commerce/customer-session';
import { isLocale, defaultLocale } from '../../i18n/utils';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Vietnamese phone numbers only: '0' or '+84' followed by 9-10 more
// digits (covers the standard 10-digit mobile format and slightly longer
// landline/area-code numbers). Separators a customer might type
// (spaces, dots, dashes, parens) are stripped before testing.
const PHONE_RE = /^(0|\+84)\d{9,10}$/;

function isValidVnPhone(value: string): boolean {
  return PHONE_RE.test(value.replace(/[\s().-]/g, ''));
}

function requiredString(value: unknown, maxLength = 500): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) return null;
  return trimmed;
}

// --- Per-IP checkout rate limit -----------------------------------------
// /api/checkout has no session/account to key a limiter on (guest checkout
// is allowed -- see this file's own top-of-file doc comment), so IP is the
// only real signal available. `checkOrigin` above stops a REAL browser
// from being tricked into cross-site submission (classic CSRF); it does
// NOT stop a script that sets its own Origin header and just calls this
// endpoint directly, repeatedly -- with COD/bank-transfer as the only
// payment methods (no gateway to reject a bad payment), an unthrottled
// endpoint lets that script place real orders that really decrement real
// inventory. Same atomic INSERT ... ON CONFLICT DO UPDATE counter shape as
// customer-auth.ts's checkAndRecordLoginAttempt (see that function's doc
// comment for why this must be one statement, not a JS read-then-write) --
// keyed by `clientAddress` (Astro's own resolved client IP, populated by
// the @astrojs/vercel adapter from Vercel's trusted proxy chain) rather
// than a raw `x-forwarded-for` header a caller could set itself.
const CHECKOUT_ATTEMPT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const CHECKOUT_ATTEMPT_MAX = 10;

async function checkAndRecordCheckoutAttempt(ip: string): Promise<boolean> {
  const windowSeconds = CHECKOUT_ATTEMPT_WINDOW_MS / 1000;
  const windowExpired = sql`${checkoutAttempts.windowStartedAt} < now() - (interval '1 second' * ${windowSeconds})`;

  const [row] = await db
    .insert(checkoutAttempts)
    .values({ ip, count: 1 })
    .onConflictDoUpdate({
      target: checkoutAttempts.ip,
      set: {
        count: sql`case when ${windowExpired} then 1 else ${checkoutAttempts.count} + 1 end`,
        windowStartedAt: sql`case when ${windowExpired} then now() else ${checkoutAttempts.windowStartedAt} end`,
      },
    })
    .returning({ count: checkoutAttempts.count });

  return row.count <= CHECKOUT_ATTEMPT_MAX;
}

function optionalString(value: unknown, maxLength = 500): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : undefined;
}

function orderErrorStatus(code: OrderError['code']): number {
  return code === 'empty_cart' ? 409 : 409;
}

export const ALL: APIRoute = async ({ request, cookies, url, clientAddress }) => {
  const methodError = checkMethod(request, ['POST']);
  if (methodError) return methodError;
  const originError = checkOrigin(request);
  if (originError) return originError;

  // Recorded before parsing/validating the body, on purpose -- same
  // reasoning as customer-auth.ts's login-attempt limiter: a caller
  // spamming malformed/invalid requests must still be throttled, not just
  // ones that would have succeeded.
  let clientIp: string;
  try {
    clientIp = clientAddress;
  } catch {
    // clientAddress throws if the adapter can't resolve it (e.g. a fully
    // static/prerendered context, which this route isn't -- prerender is
    // false above -- but failing safe here rather than letting the whole
    // request 500). Falls into one shared bucket, which under-throttles
    // if this ever happens for many different real visitors at once, but
    // never blocks checkout outright.
    clientIp = 'unknown';
  }
  const withinLimit = await checkAndRecordCheckoutAttempt(clientIp);
  if (!withinLimit) return jsonError(429, 'too_many_requests');

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
  if (!customerPhone || !isValidVnPhone(customerPhone)) return jsonError(400, 'invalid_customer_phone');
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
