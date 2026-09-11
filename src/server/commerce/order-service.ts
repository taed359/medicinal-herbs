/**
 * Order placement — the ONLY place that turns a cart into an order.
 * Recomputes price/stock from scratch (never trusts anything the client
 * sends beyond ids/quantities via the cart itself, and shipping/contact
 * form fields) — see cart-service.ts's file-level doc comment for the
 * same "live price/stock" rule this reuses via `loadCartForCheckout`.
 *
 * Payment is COD or manual bank-transfer ONLY (see
 * claude/project-status.md's "Cart & Checkout" section) — there is no
 * payment-gateway callback/webhook anywhere in this codebase. `orders`
 * always starts at status 'pending' / paymentStatus 'unpaid'; moving it
 * forward (confirmed, paid, shipped, ...) is a manual operator action, not
 * implemented yet (no admin order-management UI exists yet either).
 */
import { randomUUID } from 'node:crypto';
import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import { db } from '../db/client';
import {
  orders,
  orderItems,
  productVariants,
  productVariantTranslations,
  products,
  productTranslations,
  productImages,
  productImageTranslations,
  inventory,
} from '../../db/schema';
import type { Locale, OrderItemLineView, OrderView } from '../../domain/types';
import { loadCartForCheckout, clearCart } from './cart-service';

export class OrderError extends Error {
  constructor(
    public readonly code: 'empty_cart' | 'insufficient_stock',
    message: string,
    public readonly details?: { items: Array<{ variantId: string; availableStock: number }> }
  ) {
    super(message);
    this.name = 'OrderError';
  }
}

function generateOrderNumber(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = randomUUID().replace(/-/g, '').slice(0, 4).toUpperCase();
  return `DH-${stamp}-${rand}`;
}

export interface PlaceOrderInput {
  cartId: string;
  customerId: string | null;
  locale: Locale;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddressLine1: string;
  shippingWard?: string | null;
  shippingDistrict?: string | null;
  shippingProvince: string;
  note?: string | null;
  paymentMethod: 'cod' | 'bank_transfer';
}

export async function placeOrder(input: PlaceOrderInput): Promise<{ orderNumber: string }> {
  const cartLines = await loadCartForCheckout(input.cartId);
  if (cartLines.length === 0) {
    throw new OrderError('empty_cart', 'Your cart is empty.');
  }

  const insufficient = cartLines.filter((l) => l.availableStock != null && l.quantity > l.availableStock);
  if (insufficient.length > 0) {
    throw new OrderError('insufficient_stock', 'Some items no longer have enough stock.', {
      items: insufficient.map((l) => ({ variantId: l.variantId, availableStock: l.availableStock ?? 0 })),
    });
  }

  // Snapshot product/variant display data for order_items in the
  // checkout's locale — see schema.ts's order_items doc comment for why
  // this is captured now rather than joined live later.
  const variantIds = cartLines.map((l) => l.variantId);
  // Same "snapshot now, never re-join live" reasoning extends to the
  // image: order_items.image_url/alt/width/height (see schema.ts's doc
  // comment on that table) freeze whatever the product's PRIMARY image
  // was at the moment of purchase, so a later photo change/removal can
  // never alter historical order confirmations. Left-joined (not inner)
  // because a product with no primary image yet must still produce an
  // order line -- it just snapshots no image, same as it shows no image
  // anywhere else today.
  const snapshotRows = await db
    .select({
      variantId: productVariants.id,
      sku: productVariants.sku,
      variantLabel: productVariantTranslations.label,
      productName: productTranslations.name,
      imageUrl: productImages.url,
      imageWidth: productImages.width,
      imageHeight: productImages.height,
      imageAlt: productImageTranslations.alt,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(
      productTranslations,
      and(eq(productTranslations.productId, products.id), eq(productTranslations.locale, input.locale))
    )
    .leftJoin(
      productVariantTranslations,
      and(eq(productVariantTranslations.variantId, productVariants.id), eq(productVariantTranslations.locale, input.locale))
    )
    .leftJoin(productImages, and(eq(productImages.productId, products.id), eq(productImages.role, 'primary')))
    .leftJoin(
      productImageTranslations,
      and(eq(productImageTranslations.imageId, productImages.id), eq(productImageTranslations.locale, input.locale))
    )
    .where(inArray(productVariants.id, variantIds));
  const snapshotMap = new Map(snapshotRows.map((r) => [r.variantId, r]));

  const subtotalMinor = cartLines.reduce((sum, l) => sum + l.priceMinor * l.quantity, 0);
  // No shipping-fee calculation yet (flat/free) — a real rate table (by
  // province/weight/carrier) is future scope, same posture as payment
  // gateway integration; `orders.shipping_fee_minor` already exists so
  // adding one later never needs a schema change.
  const shippingFeeMinor = 0;
  const totalMinor = subtotalMinor + shippingFeeMinor;
  const currency = cartLines[0].currency;
  const orderId = randomUUID();
  let orderNumber = generateOrderNumber();

  await db.transaction(async (tx) => {
    // Decrement tracked inventory first, CONDITIONALLY (quantity >= needed
    // in the same UPDATE) so a race with a concurrent checkout can never
    // oversell — zero rows affected means someone else took the last unit
    // between our read above and now; abort the whole order.
    for (const line of cartLines) {
      const [invRow] = await tx
        .select({ quantity: inventory.quantity })
        .from(inventory)
        .where(eq(inventory.variantId, line.variantId));
      if (invRow?.quantity == null) continue; // untracked stock for this variant

      const updated = await tx
        .update(inventory)
        .set({ quantity: sql`${inventory.quantity} - ${line.quantity}`, updatedAt: new Date() })
        .where(and(eq(inventory.variantId, line.variantId), gte(inventory.quantity, line.quantity)))
        .returning({ variantId: inventory.variantId });

      if (updated.length === 0) {
        throw new OrderError('insufficient_stock', 'Some items sold out while placing your order.', {
          items: [{ variantId: line.variantId, availableStock: 0 }],
        });
      }
    }

    // Retry on the (astronomically unlikely) orderNumber collision —
    // it's a unique constraint, not a sequence, so a retry is the correct
    // handling rather than a pre-check query.
    for (let attempt = 0; ; attempt++) {
      try {
        await tx.insert(orders).values({
          id: orderId,
          orderNumber,
          customerId: input.customerId ?? undefined,
          paymentMethod: input.paymentMethod,
          currency,
          subtotalMinor,
          shippingFeeMinor,
          totalMinor,
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          customerPhone: input.customerPhone,
          shippingAddressLine1: input.shippingAddressLine1,
          shippingWard: input.shippingWard ?? undefined,
          shippingDistrict: input.shippingDistrict ?? undefined,
          shippingProvince: input.shippingProvince,
          note: input.note ?? undefined,
        });
        break;
      } catch (err) {
        const isUniqueViolation = typeof err === 'object' && err !== null && (err as { code?: unknown }).code === '23505';
        if (isUniqueViolation && attempt < 2) {
          orderNumber = generateOrderNumber();
          continue;
        }
        throw err;
      }
    }

    await tx.insert(orderItems).values(
      cartLines.map((line) => {
        const snap = snapshotMap.get(line.variantId);
        return {
          id: randomUUID(),
          orderId,
          variantId: line.variantId,
          productName: snap?.productName ?? line.variantId,
          variantLabel: snap?.variantLabel ?? undefined,
          sku: snap?.sku ?? '',
          unitPriceMinor: line.priceMinor,
          quantity: line.quantity,
          lineTotalMinor: line.priceMinor * line.quantity,
          imageUrl: snap?.imageUrl ?? undefined,
          imageAlt: snap?.imageAlt ?? undefined,
          imageWidth: snap?.imageWidth ?? undefined,
          imageHeight: snap?.imageHeight ?? undefined,
        };
      })
    );
  });

  await clearCart(input.cartId);

  return { orderNumber };
}

/** Guest-safe order lookup for the confirmation page: requires the email
 *  to match the order's own customerEmail (case-insensitive) so an order
 *  number alone (guessable/short) can't be used to pull a stranger's name/
 *  address/phone. Returns null on any mismatch or missing order — never
 *  distinguishes the two in the response, to avoid confirming which order
 *  numbers exist. */
export async function getOrderByNumberForEmail(orderNumber: string, email: string): Promise<OrderView | null> {
  const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber));
  if (!order) return null;
  if (order.customerEmail.trim().toLowerCase() !== email.trim().toLowerCase()) return null;

  const itemRows = await db
    .select({
      productName: orderItems.productName,
      variantLabel: orderItems.variantLabel,
      sku: orderItems.sku,
      unitPriceMinor: orderItems.unitPriceMinor,
      quantity: orderItems.quantity,
      lineTotalMinor: orderItems.lineTotalMinor,
      imageUrl: orderItems.imageUrl,
      imageAlt: orderItems.imageAlt,
      imageWidth: orderItems.imageWidth,
      imageHeight: orderItems.imageHeight,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id))
    .orderBy(orderItems.id);

  const items: OrderItemLineView[] = itemRows.map((row) => ({
    productName: row.productName,
    variantLabel: row.variantLabel,
    sku: row.sku,
    unitPriceMinor: row.unitPriceMinor,
    quantity: row.quantity,
    lineTotalMinor: row.lineTotalMinor,
    image:
      row.imageUrl != null && row.imageWidth != null && row.imageHeight != null
        ? { url: row.imageUrl, alt: row.imageAlt ?? '', width: row.imageWidth, height: row.imageHeight }
        : null,
  }));

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMethod: order.paymentMethod as 'cod' | 'bank_transfer',
    paymentStatus: order.paymentStatus,
    currency: order.currency,
    subtotalMinor: order.subtotalMinor,
    shippingFeeMinor: order.shippingFeeMinor,
    totalMinor: order.totalMinor,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    shippingAddressLine1: order.shippingAddressLine1,
    shippingWard: order.shippingWard,
    shippingDistrict: order.shippingDistrict,
    shippingProvince: order.shippingProvince,
    note: order.note,
    createdAt: order.createdAt.toISOString(),
    items,
  };
}
