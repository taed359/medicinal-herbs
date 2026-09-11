/**
 * Cart business logic — the ONLY place that reads/writes carts/cart_items.
 * API routes (src/pages/api/cart/**) call these functions; they never touch
 * `db`/schema directly for cart concerns. Mirrors the existing separation
 * between src/server/repositories (read models for pages) and this file
 * (mutations + business rules) the same way src/server/repositories/admin
 * separates admin writes from the public read repositories.
 *
 * PRICE/STOCK ARE ALWAYS LIVE, NEVER TRUSTED FROM THE CLIENT: every
 * function here re-derives price from `pricing` and stock from `inventory`
 * at call time — see schema.ts's cart_items doc comment for why cart_items
 * itself stores no price. A variant with no active price row (e.g.
 * wholesale/price-on-request) can never be added to a cart — `addItem`
 * throws `CartError('no_price', ...)` for it; product pages are expected
 * to not even render a working Add to Cart control for such a variant
 * (see ProductDetail.astro), but this is the real, authoritative guard.
 */
import { randomUUID } from 'node:crypto';
import { and, desc, eq, gt, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import type { AstroCookies } from 'astro';
import { db } from '../db/client';
import {
  carts,
  cartItems,
  products,
  productTranslations,
  productVariants,
  productVariantTranslations,
  productImages,
  productImageTranslations,
  pricing,
  inventory,
} from '../../db/schema';
import type { Locale, CartView, CartItemView, LocalizedImage } from '../../domain/types';
import { readCartId, writeCartId } from './cart-cookie';

export class CartError extends Error {
  constructor(
    public readonly code: 'no_price' | 'insufficient_stock' | 'not_found' | 'invalid_quantity',
    message: string,
    public readonly details?: { availableStock?: number }
  ) {
    super(message);
    this.name = 'CartError';
  }
}

const EMPTY_CART: CartView = { id: null, items: [], itemCount: 0, subtotalMinor: 0, currency: 'VND' };

/** "Current" price for one variant — same effective-window logic as
 *  product-repository.ts's fetchCurrentPricing, just single-variant. */
async function getCurrentPrice(variantId: string): Promise<{ priceMinor: number; currency: string } | null> {
  const now = sql`now()`;
  const [row] = await db
    .select({ priceMinor: pricing.priceMinor, currency: pricing.currency, effectiveFrom: pricing.effectiveFrom })
    .from(pricing)
    .where(
      and(
        eq(pricing.variantId, variantId),
        lte(pricing.effectiveFrom, now),
        or(isNull(pricing.effectiveTo), gt(pricing.effectiveTo, now))
      )
    )
    .orderBy(desc(pricing.effectiveFrom))
    .limit(1);
  return row ? { priceMinor: row.priceMinor, currency: row.currency } : null;
}

async function getAvailableStock(variantId: string): Promise<number | null> {
  const [row] = await db
    .select({ quantity: inventory.quantity })
    .from(inventory)
    .where(eq(inventory.variantId, variantId));
  return row?.quantity ?? null;
}

/** Reads the cart id from the cookie and returns a fully-resolved cart
 *  view for `locale`, or the empty cart if no cookie/row exists. Never
 *  creates anything — read-only. */
export async function getCart(cookies: AstroCookies, locale: Locale): Promise<CartView> {
  const cartId = readCartId(cookies);
  if (!cartId) return EMPTY_CART;
  return loadCartView(cartId, locale);
}

async function loadCartView(cartId: string, locale: Locale): Promise<CartView> {
  const [cartRow] = await db.select({ id: carts.id, currency: carts.currency }).from(carts).where(eq(carts.id, cartId));
  if (!cartRow) return EMPTY_CART;

  const rows = await db
    .select({
      itemId: cartItems.id,
      quantity: cartItems.quantity,
      variantId: productVariants.id,
      sku: productVariants.sku,
      variantLabel: productVariantTranslations.label,
      productId: products.id,
      productSlug: products.slug,
      categoryId: products.categoryId,
      productName: productTranslations.name,
      inventoryQuantity: inventory.quantity,
    })
    .from(cartItems)
    .innerJoin(productVariants, eq(productVariants.id, cartItems.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(
      productTranslations,
      and(eq(productTranslations.productId, products.id), eq(productTranslations.locale, locale))
    )
    .leftJoin(
      productVariantTranslations,
      and(eq(productVariantTranslations.variantId, productVariants.id), eq(productVariantTranslations.locale, locale))
    )
    .leftJoin(inventory, eq(inventory.variantId, productVariants.id))
    .where(eq(cartItems.cartId, cartId))
    .orderBy(cartItems.createdAt);

  if (rows.length === 0) return { id: cartId, items: [], itemCount: 0, subtotalMinor: 0, currency: cartRow.currency };

  const priceMap = new Map<string, { priceMinor: number; currency: string }>();
  for (const r of rows) {
    if (!priceMap.has(r.variantId)) {
      const price = await getCurrentPrice(r.variantId);
      if (price) priceMap.set(r.variantId, price);
    }
  }

  const productIds = [...new Set(rows.map((r) => r.productId))];
  const imageRows = productIds.length
    ? await db
        .select({
          productId: productImages.productId,
          id: productImages.id,
          url: productImages.url,
          width: productImages.width,
          height: productImages.height,
          role: productImages.role,
          sortOrder: productImages.sortOrder,
          alt: productImageTranslations.alt,
        })
        .from(productImages)
        .leftJoin(
          productImageTranslations,
          and(eq(productImageTranslations.imageId, productImages.id), eq(productImageTranslations.locale, locale))
        )
        .where(and(inArray(productImages.productId, productIds), eq(productImages.role, 'primary')))
    : [];
  const imageMap = new Map<string, LocalizedImage>();
  for (const img of imageRows) {
    imageMap.set(img.productId, {
      id: img.id,
      url: img.url,
      alt: img.alt ?? '',
      width: img.width,
      height: img.height,
      role: img.role as LocalizedImage['role'],
      sortOrder: img.sortOrder,
    });
  }

  // A variant that lost its price after being added (e.g. converted to
  // price-on-request) is dropped from the cart view entirely rather than
  // shown with a fabricated price — it's already unpurchasable, so it's
  // treated the same as if it were never added. This is a deliberately
  // silent, self-healing state (no separate "removed" list); checkout
  // re-validates the whole cart anyway.
  const items: CartItemView[] = [];
  let subtotalMinor = 0;
  let currency = cartRow.currency;
  for (const r of rows) {
    const price = priceMap.get(r.variantId);
    if (!price) continue;
    const lineTotalMinor = price.priceMinor * r.quantity;
    subtotalMinor += lineTotalMinor;
    currency = price.currency;
    items.push({
      id: r.itemId,
      variantId: r.variantId,
      productId: r.productId,
      productSlug: r.productSlug,
      categoryId: r.categoryId,
      productName: r.productName,
      variantLabel: r.variantLabel ?? '',
      sku: r.sku,
      image: imageMap.get(r.productId) ?? null,
      unitPriceMinor: price.priceMinor,
      currency: price.currency,
      quantity: r.quantity,
      lineTotalMinor,
      availableStock: r.inventoryQuantity ?? null,
    });
  }

  return {
    id: cartId,
    items,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    subtotalMinor,
    currency,
  };
}

/** Returns the current cart id, creating a fresh cart row + cookie if
 *  none exists yet. `customerId` is attached immediately when the caller
 *  is a signed-in customer (so a cart a logged-in visitor starts is
 *  already theirs — no separate merge needed for that case; merge only
 *  matters for a cart started while signed out, see mergeCartOnLogin). */
async function ensureCart(cookies: AstroCookies, customerId: string | null): Promise<string> {
  const existingId = readCartId(cookies);
  if (existingId) {
    const [row] = await db.select({ id: carts.id }).from(carts).where(eq(carts.id, existingId));
    if (row) return row.id;
    // Stale cookie (row deleted / DB reset) — fall through and create fresh.
  }

  const id = randomUUID();
  await db.insert(carts).values({ id, customerId: customerId ?? undefined });
  writeCartId(cookies, id);
  return id;
}

function assertValidQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new CartError('invalid_quantity', 'Quantity must be a positive integer.');
  }
}

export async function addItem(
  cookies: AstroCookies,
  customerId: string | null,
  variantId: string,
  quantity: number,
  locale: Locale
): Promise<CartView> {
  assertValidQuantity(quantity);

  const price = await getCurrentPrice(variantId);
  if (!price) {
    throw new CartError('no_price', 'This item is not available for online purchase (price on request).');
  }

  const cartId = await ensureCart(cookies, customerId);

  const [existing] = await db
    .select({ id: cartItems.id, quantity: cartItems.quantity })
    .from(cartItems)
    .where(and(eq(cartItems.cartId, cartId), eq(cartItems.variantId, variantId)));

  const newQuantity = (existing?.quantity ?? 0) + quantity;

  const availableStock = await getAvailableStock(variantId);
  if (availableStock != null && newQuantity > availableStock) {
    throw new CartError('insufficient_stock', 'Not enough stock available.', { availableStock });
  }

  if (existing) {
    await db.update(cartItems).set({ quantity: newQuantity, updatedAt: new Date() }).where(eq(cartItems.id, existing.id));
  } else {
    await db.insert(cartItems).values({ id: randomUUID(), cartId, variantId, quantity: newQuantity });
  }
  await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cartId));

  return loadCartView(cartId, locale);
}

export async function updateItemQuantity(
  cookies: AstroCookies,
  itemId: string,
  quantity: number,
  locale: Locale
): Promise<CartView> {
  const cartId = readCartId(cookies);
  if (!cartId) throw new CartError('not_found', 'No active cart.');

  const [item] = await db
    .select({ id: cartItems.id, variantId: cartItems.variantId })
    .from(cartItems)
    .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)));
  if (!item) throw new CartError('not_found', 'Cart item not found.');

  if (quantity <= 0) {
    await db.delete(cartItems).where(eq(cartItems.id, itemId));
    return loadCartView(cartId, locale);
  }

  assertValidQuantity(quantity);
  const availableStock = await getAvailableStock(item.variantId);
  if (availableStock != null && quantity > availableStock) {
    throw new CartError('insufficient_stock', 'Not enough stock available.', { availableStock });
  }

  await db.update(cartItems).set({ quantity, updatedAt: new Date() }).where(eq(cartItems.id, itemId));
  await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cartId));
  return loadCartView(cartId, locale);
}

export async function removeItem(cookies: AstroCookies, itemId: string, locale: Locale): Promise<CartView> {
  const cartId = readCartId(cookies);
  if (!cartId) throw new CartError('not_found', 'No active cart.');

  await db.delete(cartItems).where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)));
  return loadCartView(cartId, locale);
}

/**
 * Called right after a successful customer sign-in (see login.astro).
 * Reconciles a guest cart built up before login with the customer's own
 * cart:
 *   - No guest cart cookie -> if the customer already has an active cart
 *     from a previous session, just re-point the cookie at it (so the
 *     drawer/header immediately reflect it on this device too).
 *   - Guest cart exists, customer has none yet -> the guest cart becomes
 *     theirs (claim, not a copy — same row, `customerId` set).
 *   - Both exist -> guest cart's line items are merged (quantities summed,
 *     clamped to available stock -- best-effort, not a hard failure: a
 *     merge should never block login) into the customer's existing cart,
 *     then the now-empty guest cart is deleted and the cookie re-pointed.
 */
export async function mergeCartOnLogin(cookies: AstroCookies, customerId: string): Promise<void> {
  const guestCartId = readCartId(cookies);

  const [customerCart] = await db
    .select({ id: carts.id })
    .from(carts)
    .where(and(eq(carts.customerId, customerId), eq(carts.status, 'active')))
    .orderBy(desc(carts.updatedAt))
    .limit(1);

  if (!guestCartId) {
    if (customerCart) writeCartId(cookies, customerCart.id);
    return;
  }

  if (guestCartId === customerCart?.id) return; // already the same cart

  const [guestCart] = await db.select({ id: carts.id }).from(carts).where(eq(carts.id, guestCartId));
  if (!guestCart) {
    if (customerCart) writeCartId(cookies, customerCart.id);
    return;
  }

  if (!customerCart) {
    await db.update(carts).set({ customerId, updatedAt: new Date() }).where(eq(carts.id, guestCartId));
    writeCartId(cookies, guestCartId);
    return;
  }

  const guestItems = await db
    .select({ variantId: cartItems.variantId, quantity: cartItems.quantity })
    .from(cartItems)
    .where(eq(cartItems.cartId, guestCartId));

  for (const gi of guestItems) {
    const [existing] = await db
      .select({ id: cartItems.id, quantity: cartItems.quantity })
      .from(cartItems)
      .where(and(eq(cartItems.cartId, customerCart.id), eq(cartItems.variantId, gi.variantId)));

    let mergedQuantity = (existing?.quantity ?? 0) + gi.quantity;
    const availableStock = await getAvailableStock(gi.variantId);
    if (availableStock != null) mergedQuantity = Math.min(mergedQuantity, Math.max(availableStock, 0));
    if (mergedQuantity <= 0) continue;

    if (existing) {
      await db.update(cartItems).set({ quantity: mergedQuantity, updatedAt: new Date() }).where(eq(cartItems.id, existing.id));
    } else {
      await db.insert(cartItems).values({ id: randomUUID(), cartId: customerCart.id, variantId: gi.variantId, quantity: mergedQuantity });
    }
  }

  await db.delete(carts).where(eq(carts.id, guestCartId));
  await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, customerCart.id));
  writeCartId(cookies, customerCart.id);
}

/** Internal helper reused by order-service.ts: loads the raw cart rows
 *  (variant id, quantity, live price, available stock) without the
 *  locale-dependent display fields — checkout doesn't render a product
 *  name from this, it snapshots one from the same source
 *  order-service.ts already re-fetches for the order_items insert. */
export async function loadCartForCheckout(
  cartId: string
): Promise<Array<{ variantId: string; quantity: number; priceMinor: number; currency: string; availableStock: number | null }>> {
  const rows = await db
    .select({ variantId: cartItems.variantId, quantity: cartItems.quantity, inventoryQuantity: inventory.quantity })
    .from(cartItems)
    .leftJoin(inventory, eq(inventory.variantId, cartItems.variantId))
    .where(eq(cartItems.cartId, cartId));

  const result: Array<{ variantId: string; quantity: number; priceMinor: number; currency: string; availableStock: number | null }> = [];
  for (const r of rows) {
    const price = await getCurrentPrice(r.variantId);
    if (!price) continue; // same self-healing rule as loadCartView
    result.push({
      variantId: r.variantId,
      quantity: r.quantity,
      priceMinor: price.priceMinor,
      currency: price.currency,
      availableStock: r.inventoryQuantity ?? null,
    });
  }
  return result;
}

export async function clearCart(cartId: string): Promise<void> {
  await db.delete(cartItems).where(eq(cartItems.cartId, cartId));
}
