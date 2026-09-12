/**
 * Postgres implementation of AdminOrderRepository (see
 * ../types.ts for the interface contract). Mirrors
 * admin-product-repository.ts's own structure (explicit column
 * selection, a closed SORTABLE_COLUMNS allow-list, page/pageSize
 * clamped before use) but is a separate class in its own file -- orders
 * and products share no query logic, so there's nothing to factor out
 * between them beyond the shape of the pattern itself.
 */
import { and, asc, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { db } from '../../../db/client';
import { orders, orderItems } from '../../../../db/schema';
import type {
  AdminOrderDetailView,
  AdminOrderItemLine,
  AdminOrderListItem,
  AdminOrderListParams,
  AdminOrderListResult,
  AdminOrderStats,
  AdminOrderStatusUpdateInput,
} from '../../../../domain/admin-order-types';
import type { AdminOrderRepository } from '../types';

// Closed allow-list mapping every grid-sortable column name to a real,
// known-safe SQL expression -- same discipline as
// admin-product-repository.ts's own SORTABLE_COLUMNS. A raw column name
// from the URL's `sort` query param is never accepted;
// parseAdminOrderListParams (the page) only ever produces one of these
// two keys.
const SORTABLE_COLUMNS = {
  createdAt: orders.createdAt,
  totalMinor: orders.totalMinor,
} as const;

type OrderRow = typeof orders.$inferSelect;

function toListItem(row: OrderRow, itemCount: number): AdminOrderListItem {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    status: row.status as AdminOrderListItem['status'],
    paymentMethod: row.paymentMethod as 'cod' | 'bank_transfer',
    paymentStatus: row.paymentStatus as AdminOrderListItem['paymentStatus'],
    totalMinor: row.totalMinor,
    currency: row.currency,
    itemCount,
    createdAt: row.createdAt.toISOString(),
  };
}

class PostgresAdminOrderRepository implements AdminOrderRepository {
  async list(params: AdminOrderListParams): Promise<AdminOrderListResult> {
    const page = Math.max(1, Math.trunc(params.page));
    const pageSize = Math.max(1, Math.trunc(params.pageSize));

    const conditions: SQL[] = [];

    const search = params.search.trim();
    if (search) {
      const pattern = `%${search}%`;
      // Matches order number, customer name, or customer email -- the
      // three fields an operator realistically has on hand when looking
      // for one order (a receipt number, a name a customer gave over the
      // phone, or the email they checked out with). Two literal args are
      // always passed to `or()`, so it's guaranteed to return a real SQL
      // expression, never undefined.
      conditions.push(
        or(
          ilike(orders.orderNumber, pattern),
          ilike(orders.customerName, pattern),
          ilike(orders.customerEmail, pattern)
        )!
      );
    }
    if (params.status !== 'all') {
      conditions.push(eq(orders.status, params.status));
    }
    if (params.paymentStatus !== 'all') {
      conditions.push(eq(orders.paymentStatus, params.paymentStatus));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ value: total }] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(orders)
      .where(whereClause);

    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    const sortColumn = SORTABLE_COLUMNS[params.sort];
    const orderBy = params.direction === 'asc' ? asc(sortColumn) : desc(sortColumn);

    // LEFT JOIN + GROUP BY for itemCount, not a correlated subquery --
    // see order-service.ts's listOrdersForCustomer/listOrdersForCustomerPaged
    // doc comments for exactly why a `(select count(*) from order_items
    // where order_items.order_id = orders.id)` fragment is avoided here:
    // that pattern was tried once in this codebase and confirmed (in the
    // user's own browser) to always return 0.
    const rows = await db
      .select({ order: orders, itemCount: sql<number>`count(${orderItems.id})::int` })
      .from(orders)
      .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
      .where(whereClause)
      .groupBy(orders.id)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const items = rows.map((row) => toListItem(row.order, Number(row.itemCount)));

    return { items, total, page, pageSize, totalPages };
  }

  async getById(id: string): Promise<AdminOrderDetailView | null> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) return null;

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

    const items: AdminOrderItemLine[] = itemRows.map((row) => ({
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
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status as AdminOrderDetailView['status'],
      paymentMethod: order.paymentMethod as 'cod' | 'bank_transfer',
      paymentStatus: order.paymentStatus as AdminOrderDetailView['paymentStatus'],
      currency: order.currency,
      subtotalMinor: order.subtotalMinor,
      shippingFeeMinor: order.shippingFeeMinor,
      totalMinor: order.totalMinor,
      customerId: order.customerId,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      shippingAddressLine1: order.shippingAddressLine1,
      shippingWard: order.shippingWard,
      shippingDistrict: order.shippingDistrict,
      shippingProvince: order.shippingProvince,
      shippingCountryCode: order.shippingCountryCode,
      note: order.note,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      items,
    };
  }

  async updateStatus(id: string, input: AdminOrderStatusUpdateInput): Promise<void> {
    // Nothing to write -- both fields omitted. Guarded here (not just at
    // the API-route validation layer) so this repository method is safe
    // to call directly and never issues a no-op UPDATE that would still
    // bump `updatedAt` for no real change.
    if (input.status === undefined && input.paymentStatus === undefined) return;

    const set: Partial<typeof orders.$inferInsert> = { updatedAt: new Date() };
    if (input.status !== undefined) set.status = input.status;
    if (input.paymentStatus !== undefined) set.paymentStatus = input.paymentStatus;

    const updated = await db.update(orders).set(set).where(eq(orders.id, id)).returning({ id: orders.id });
    if (updated.length === 0) {
      throw new Error(`Order "${id}" not found.`);
    }
  }

  async getStats(): Promise<AdminOrderStats> {
    const [row] = await db
      .select({
        totalOrders: sql<number>`count(*)::int`,
        pendingCount: sql<number>`count(*) filter (where ${orders.status} = 'pending')::int`,
      })
      .from(orders);

    // Separate query for paid revenue -- a currency-grouped aggregate,
    // not folded into the row above, since summing totalMinor across
    // mixed currencies (however unlikely today -- see AdminOrderStats's
    // own doc comment) would silently produce a meaningless number. Only
    // the first currency group is used; if this store is ever genuinely
    // multi-currency, this figure should be revisited to show one total
    // per currency instead of picking one.
    const [revenueRow] = await db
      .select({
        currency: orders.currency,
        paidRevenueMinor: sql<number>`coalesce(sum(${orders.totalMinor}), 0)::int`,
      })
      .from(orders)
      .where(eq(orders.paymentStatus, 'paid'))
      .groupBy(orders.currency)
      .orderBy(desc(sql`sum(${orders.totalMinor})`))
      .limit(1);

    return {
      totalOrders: row?.totalOrders ?? 0,
      pendingCount: row?.pendingCount ?? 0,
      paidRevenueMinor: revenueRow?.paidRevenueMinor ?? 0,
      currency: revenueRow?.currency ?? null,
    };
  }

  async listRecent(limit: number): Promise<AdminOrderListItem[]> {
    const rows = await db
      .select({ order: orders, itemCount: sql<number>`count(${orderItems.id})::int` })
      .from(orders)
      .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
      .groupBy(orders.id)
      .orderBy(desc(orders.createdAt))
      .limit(limit);
    return rows.map((row) => toListItem(row.order, Number(row.itemCount)));
  }
}

export const adminOrderRepository: AdminOrderRepository = new PostgresAdminOrderRepository();
