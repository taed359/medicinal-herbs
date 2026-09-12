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
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
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

type OrderRow = typeof orders.$inferSelect;

/** Shared by both order-lookup functions below (guest-by-email and
 *  customer-by-id) -- pulls order_items and maps an already-fetched order
 *  row into the full OrderView shape. Extracted when the second lookup
 *  (getOrderForCustomer, for the new /customer/orders/[orderNumber] page)
 *  needed the exact same items-fetch + view-assembly logic that used to
 *  live only inside getOrderByNumberForEmail -- neither function trusts
 *  the OTHER's authorization check, they only share this pure "shape the
 *  data" step, which never touches customerId/email itself. */
async function toOrderView(order: OrderRow): Promise<OrderView> {
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
  return toOrderView(order);
}

/** Signed-in-customer order lookup for /customer/orders/[orderNumber]
 *  (the account-area order-detail page, modeled on Magento's own
 *  `sales/order/view/order_id/:id` template). Scoped by `customerId`
 *  instead of email -- a STRICTER check than the guest path above, since
 *  a signed-in customer has a real, unspoofable identity (the session)
 *  to check against, unlike a guest who only ever has the email they
 *  typed into a form. This means an order number alone can never pull
 *  another customer's order here, full stop -- there's no email to leak
 *  or match against at all. Orders placed as a guest (customerId null)
 *  are correctly invisible here even to the account matching that email
 *  later, same "no retroactive attachment" limitation already noted on
 *  listOrdersForCustomer above. */
export async function getOrderForCustomer(orderNumber: string, customerId: string): Promise<OrderView | null> {
  const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber));
  if (!order) return null;
  if (order.customerId !== customerId) return null;
  return toOrderView(order);
}
/** Lightweight order summary for a signed-in customer's own dashboard
 *  (src/pages/customer/account.astro) -- deliberately NOT the full
 *  `OrderView` shape getOrderByNumberForEmail returns above (no line
 *  items, no shipping address): a dashboard list only ever needs enough
 *  to identify an order and link to its detail view. "View" links to
 *  `getOrderForCustomer`'s own page (/customer/orders/[orderNumber]),
 *  and "View all orders" links to `listOrdersForCustomerPaged`'s own
 *  full-history page (/customer/orders) -- see both below. Item count is
 *  a single COUNT(*) rather than pulling every order_items row, since the
 *  dashboard never needs to render them. Scoped strictly by `customerId`
 *  (never by email) -- an order placed as a guest before this account
 *  existed will only show up here once it's actually attributed to this
 *  customerId (see cart-service.ts's mergeCartOnLogin for the cart-side
 *  equivalent; there is no equivalent "attach past guest orders to this
 *  account" step today -- worth flagging if it ever comes up, but out of
 *  scope here). */
export interface CustomerOrderSummary {
  orderNumber: string;
  status: string;
  paymentMethod: 'cod' | 'bank_transfer';
  paymentStatus: string;
  totalMinor: number;
  currency: string;
  itemCount: number;
  createdAt: string;
}

export async function listOrdersForCustomer(customerId: string, limit = 5): Promise<CustomerOrderSummary[]> {
  // LEFT JOIN + GROUP BY, not a correlated subquery -- see the doc
  // comment above listOrdersForCustomerPaged's own itemCount for why a
  // `(select count(*) from order_items where order_items.order_id =
  // orders.id)` fragment was tried here first and always returned 0 in
  // the user's own browser. `GROUP BY orders.id` alone is enough for
  // Postgres to let every other `orders.*` column appear ungrouped in
  // the select list (functional dependency on the primary key).
  const rows = await db
    .select({
      orderNumber: orders.orderNumber,
      status: orders.status,
      paymentMethod: orders.paymentMethod,
      paymentStatus: orders.paymentStatus,
      totalMinor: orders.totalMinor,
      currency: orders.currency,
      createdAt: orders.createdAt,
      itemCount: sql<number>`count(${orderItems.id})::int`,
    })
    .from(orders)
    .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(eq(orders.customerId, customerId))
    .groupBy(orders.id)
    .orderBy(desc(orders.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    orderNumber: row.orderNumber,
    status: row.status,
    paymentMethod: row.paymentMethod as 'cod' | 'bank_transfer',
    paymentStatus: row.paymentStatus,
    totalMinor: row.totalMinor,
    currency: row.currency,
    itemCount: Number(row.itemCount),
    createdAt: row.createdAt.toISOString(),
  }));
}

/** Full, paginated order history for a signed-in customer
 *  (src/pages/customer/orders/index.astro -- modeled on Magento's own
 *  `sales/order/history` template, which the dashboard's capped-at-10
 *  list above always deferred to via a "View All" link that had nowhere
 *  real to point until this page existed). `shipToName` is
 *  `orders.customerName` (the recipient name captured on the order
 *  itself -- see schema.ts's own doc comment on why there's no separate
 *  address-book entity to join against), matching Magento's own "Ship
 *  To" column. Same `customerId` scoping and same "no past-guest-order
 *  attachment" limitation as `listOrdersForCustomer` above. `total` is a
 *  separate COUNT(*) query (not `rows.length`) so the page can render
 *  real pagination controls (Magento's own 10/20/50-per-page limiter)
 *  instead of guessing whether another page exists.
 *
 *  `itemCount` is a LEFT JOIN + `GROUP BY orders.id` (Postgres lets every
 *  other `orders.*` column stay ungrouped once the primary key is
 *  grouped on, by functional dependency), NOT a correlated subquery --
 *  an earlier version of both this function and listOrdersForCustomer
 *  above used `(select count(*) from order_items where
 *  order_items.order_id = orders.id)`, which the user's own browser
 *  showed always returning 0 for every order (reported as "cột sản phẩm
 *  bị bug ... hiển thị toàn là 0"). That pattern has no other precedent
 *  anywhere in this codebase (grepped -- every other count() here is
 *  either a plain single-table count or a real JOIN+aggregate, e.g.
 *  admin-product-repository.ts's own getInventorySummary/list), and
 *  isn't provably correct against a real Postgres instance from this
 *  sandbox (no `psql`/DB access from the bridge -- see "Known sandbox
 *  limitation"), so this fix switches BOTH functions to the join+groupBy
 *  shape that already has working precedent in this codebase. */
export interface CustomerOrderListItem extends CustomerOrderSummary {
  shipToName: string;
}

export async function listOrdersForCustomerPaged(
  customerId: string,
  { limit, offset }: { limit: number; offset: number }
): Promise<{ items: CustomerOrderListItem[]; total: number }> {
  const [totalRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(orders)
    .where(eq(orders.customerId, customerId));

  const rows = await db
    .select({
      orderNumber: orders.orderNumber,
      status: orders.status,
      paymentMethod: orders.paymentMethod,
      paymentStatus: orders.paymentStatus,
      totalMinor: orders.totalMinor,
      currency: orders.currency,
      createdAt: orders.createdAt,
      shipToName: orders.customerName,
      itemCount: sql<number>`count(${orderItems.id})::int`,
    })
    .from(orders)
    .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(eq(orders.customerId, customerId))
    .groupBy(orders.id)
    .orderBy(desc(orders.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    total: Number(totalRow?.total ?? 0),
    items: rows.map((row) => ({
      orderNumber: row.orderNumber,
      status: row.status,
      paymentMethod: row.paymentMethod as 'cod' | 'bank_transfer',
      paymentStatus: row.paymentStatus,
      totalMinor: row.totalMinor,
      currency: row.currency,
      itemCount: Number(row.itemCount),
      createdAt: row.createdAt.toISOString(),
      shipToName: row.shipToName,
    })),
  };
}
