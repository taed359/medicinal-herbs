/**
 * Client-side cart module -- vanilla TS, no framework (this project
 * deliberately avoids React/Vue/Svelte; see claude/project-status.md).
 * Imported (not `is:inline`) by CartDrawer.astro, Header.astro,
 * ProductDetail.astro, and the cart/checkout pages, so Vite bundles it
 * once and every consumer shares the same module instance -- the
 * `document`-level CustomEvents below are what keeps them in sync with
 * each other without any of them importing one another directly (same
 * decoupling principle as Header's own `astro:page-load` re-init pattern
 * elsewhere in this codebase).
 *
 * Every mutating call re-fetches/returns the full, authoritative cart
 * from the server (see src/server/commerce/cart-service.ts) and re-
 * dispatches `cart:changed` -- nothing here ever computes a total or
 * mutates local state itself; this is a thin fetch wrapper + event bus,
 * not a client-side store.
 */
import type { CartView } from '../domain/types';

const CART_CHANGED_EVENT = 'cart:changed';
const OPEN_DRAWER_EVENT = 'cart:open-drawer';

function currentLocale(): 'vi' | 'zh' {
  return document.documentElement.lang === 'zh' ? 'zh' : 'vi';
}

/** Product detail URL for a cart/listing line -- routes are
 *  `/{locale}/products/{categoryId}/{slug}/` (categoryId IS the
 *  collection's URL segment today, e.g. "natural-oils"/"wholesale" --
 *  see src/pages/{vi,zh}/products/*). This is the client-side equivalent
 *  of the `localePath()` helper used server-side (not available in the
 *  browser); used by CartDrawer.astro, CartPage.astro, and any other
 *  client-rendered list that needs to link a cart line back to its
 *  product. */
export function cartItemHref(item: { categoryId: string; productSlug: string }): string {
  return `/${currentLocale()}/products/${item.categoryId}/${item.productSlug}/`;
}

function dispatchCartChanged(cart: CartView): void {
  document.dispatchEvent(new CustomEvent<CartView>(CART_CHANGED_EVENT, { detail: cart }));
}

export function onCartChanged(handler: (cart: CartView) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<CartView>).detail);
  document.addEventListener(CART_CHANGED_EVENT, listener);
  return () => document.removeEventListener(CART_CHANGED_EVENT, listener);
}

/** Header's cart icon (and anything else) calls this instead of directly
 *  manipulating CartDrawer's DOM -- CartDrawer listens for it. */
export function requestOpenCartDrawer(): void {
  document.dispatchEvent(new CustomEvent(OPEN_DRAWER_EVENT));
}

export function onOpenCartDrawerRequested(handler: () => void): () => void {
  const listener = () => handler();
  document.addEventListener(OPEN_DRAWER_EVENT, listener);
  return () => document.removeEventListener(OPEN_DRAWER_EVENT, listener);
}

export interface CartActionError {
  error: string;
  message?: string;
  availableStock?: number;
}

export type CartResult = { ok: true; cart: CartView } | { ok: false; error: CartActionError };

async function toCartResult(res: Response): Promise<CartResult> {
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = { error: 'unknown' };
  }
  if (!res.ok) return { ok: false, error: data as CartActionError };
  const cart = data as CartView;
  dispatchCartChanged(cart);
  return { ok: true, cart };
}

export async function fetchCart(): Promise<CartView> {
  const res = await fetch(`/api/cart?locale=${currentLocale()}`, { credentials: 'same-origin', cache: 'no-store' });
  const cart = (await res.json()) as CartView;
  dispatchCartChanged(cart);
  return cart;
}

// Refresh the cart whenever the browser restores this page from the
// back-forward cache (bfcache) -- e.g. the visitor adds an item on
// another product page, then presses Back. A bfcache restore reanimates
// the EXACT DOM/JS state that existed the moment they navigated away --
// no script re-runs, no `astro:page-load`, nothing -- so every cart
// badge/drawer/page they see stays frozen on whatever the cart looked
// like before they left, even though the server-side cart has since
// changed (reported: "back về history thì cart vẫn đang là 4" after
// adding a 5th item elsewhere). `pageshow`'s `persisted` flag is how a
// page tells a bfcache restore apart from a normal, fresh load -- a
// plain unconditional refetch here would also double-fetch on every
// ordinary page load, since other init code (CartDrawer.astro's own
// `initCartDrawer`) already fetches once on a real load.
//
// This module is a singleton (loaded via <script type="module">, and
// CartDrawer.astro -- which imports it -- is mounted once in
// Layout.astro, so it's present on every page), so this top-level
// listener registers exactly once per real page load and, like
// `onCartChanged`'s own `document`-level subscription, persists across
// Astro soft-navigations without needing an `astro:page-load` re-init.
if (typeof window !== 'undefined') {
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      fetchCart().catch(() => {});
    }
  });
}

export async function addToCart(variantId: string, quantity = 1): Promise<CartResult> {
  const res = await fetch(`/api/cart/items?locale=${currentLocale()}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ variantId, quantity }),
    credentials: 'same-origin',
  });
  return toCartResult(res);
}

export async function updateCartItem(itemId: string, quantity: number): Promise<CartResult> {
  const res = await fetch(`/api/cart/items/${encodeURIComponent(itemId)}?locale=${currentLocale()}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ quantity }),
    credentials: 'same-origin',
  });
  return toCartResult(res);
}

export async function removeCartItem(itemId: string): Promise<CartResult> {
  const res = await fetch(`/api/cart/items/${encodeURIComponent(itemId)}?locale=${currentLocale()}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  });
  return toCartResult(res);
}

/** Same formatting rule as ProductDetail.astro's own formatPrice --
 *  VND has no minor/fractional unit in practice, so priceMinor is
 *  formatted directly, never divided by 100. Duplicated here (not
 *  imported from ProductDetail.astro) because this runs client-side in
 *  the browser, not at Astro build/render time. */
export function formatMoney(minorUnits: number, currency: string): string {
  const locale = currentLocale();
  return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'vi-VN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(minorUnits);
}
