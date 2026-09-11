/**
 * The guest/customer cart identity cookie.
 *
 * A cart is identified by an opaque id kept in an httpOnly `cart_id`
 * cookie — created lazily on the first add-to-cart (see cart-service.ts's
 * `ensureCart`), never for every visitor. This is deliberately its own
 * plain cookie, NOT part of either Better Auth instance's session/cookie:
 * a cart must survive across login/logout (a guest cart's contents merge
 * into the customer's cart on sign-in — see cart-service.ts's
 * `mergeCartOnLogin`), and must work for a visitor who never creates an
 * account at all.
 *
 * `secure` mirrors the same rule Better Auth already applies to its own
 * cookies (see customer-auth.ts's advanced.cookiePrefix comment): Secure
 * only when the deployment's own origin is https, so local http dev still
 * works. 30-day maxAge matches the customer session's own expiresIn.
 */
import type { AstroCookies } from 'astro';

const CART_COOKIE_NAME = 'cart_id';
const CART_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function isSecureDeployment(): boolean {
  const raw = process.env.BETTER_AUTH_URL;
  if (!raw) return false;
  try {
    return new URL(raw).protocol === 'https:';
  } catch {
    return false;
  }
}

export function readCartId(cookies: AstroCookies): string | null {
  const value = cookies.get(CART_COOKIE_NAME)?.value;
  return value && value.length > 0 ? value : null;
}

export function writeCartId(cookies: AstroCookies, cartId: string): void {
  cookies.set(CART_COOKIE_NAME, cartId, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: isSecureDeployment(),
    maxAge: CART_COOKIE_MAX_AGE_SECONDS,
  });
}

export function clearCartId(cookies: AstroCookies): void {
  cookies.delete(CART_COOKIE_NAME, { path: '/' });
}
