/**
 * Admin-only read/write shapes for order management (Phase — Admin
 * Orders). Deliberately its own file rather than folded into
 * src/domain/admin-types.ts (which is already large and Product-CRUD-
 * specific): orders are a different entity with no field overlap, and
 * keeping them apart mirrors how src/server/commerce/order-service.ts is
 * already its own module, separate from the product repositories.
 *
 * `AdminOrderStatus`/`AdminOrderPaymentStatus` mirror the exact allowed
 * values already enforced by src/db/schema.ts's own CHECK constraints
 * (`orders_status_check`, `orders_payment_status_check`) -- these are not
 * invented here, they're the same closed set the DB has always had,
 * just now with an admin UI able to set them (previously only
 * order-service.ts's `placeOrder` ever wrote a status, always the fixed
 * starting values 'pending'/'unpaid').
 */

export const ADMIN_ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'completed', 'cancelled'] as const;
export type AdminOrderStatus = (typeof ADMIN_ORDER_STATUSES)[number];

export const ADMIN_ORDER_PAYMENT_STATUSES = ['unpaid', 'paid', 'refunded'] as const;
export type AdminOrderPaymentStatus = (typeof ADMIN_ORDER_PAYMENT_STATUSES)[number];

/** One row in the Orders Admin Grid. Deliberately lighter than
 *  AdminOrderDetailView below -- no line items, no shipping address --
 *  same "list vs. detail" split already established by
 *  CustomerOrderSummary vs. OrderView in order-service.ts/domain/types.ts. */
export interface AdminOrderListItem {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  status: AdminOrderStatus;
  paymentMethod: 'cod' | 'bank_transfer';
  paymentStatus: AdminOrderPaymentStatus;
  totalMinor: number;
  currency: string;
  itemCount: number;
  createdAt: string; // ISO 8601
}

export interface AdminOrderListResult {
  items: AdminOrderListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Columns the Orders Grid can sort by -- same closed-allow-list
 *  discipline as AdminProductSortColumn (see admin-types.ts): the
 *  repository maps each value to a real, known-safe column expression,
 *  a raw column name from the URL is never accepted. */
export type AdminOrderSortColumn = 'createdAt' | 'totalMinor';
export type AdminOrderSortDirection = 'asc' | 'desc';
export type AdminOrderStatusFilter = 'all' | AdminOrderStatus;
export type AdminOrderPaymentStatusFilter = 'all' | AdminOrderPaymentStatus;

export interface AdminOrderListParams {
  /** 1-based. */
  page: number;
  pageSize: number;
  /** Trimmed by the repository before use; matched against order number
   *  (exact/prefix) and customer name/email (ILIKE), same "search a
   *  couple of obviously-relevant text fields" scope as the Products
   *  Grid's own name-only search. */
  search: string;
  status: AdminOrderStatusFilter;
  paymentStatus: AdminOrderPaymentStatusFilter;
  sort: AdminOrderSortColumn;
  direction: AdminOrderSortDirection;
}

/** One order_items row as shown on the order detail page -- read-only,
 *  a historical snapshot (see schema.ts's own doc comment on
 *  order_items: name/sku/price are frozen at order time and never
 *  re-joined live), so this is never editable from admin. Mirrors
 *  OrderItemLineView in src/domain/types.ts field-for-field; kept as its
 *  own type here rather than importing that one so this file has no
 *  dependency on the customer-facing domain/types.ts module (same
 *  "admin shapes don't share a type with storefront views" reasoning as
 *  admin-types.ts's own top-of-file doc comment). */
export interface AdminOrderItemLine {
  productName: string;
  variantLabel: string | null;
  sku: string;
  unitPriceMinor: number;
  quantity: number;
  lineTotalMinor: number;
  image: { url: string; alt: string; width: number; height: number } | null;
}

/** Full order detail, as shown on /admin/orders/[id] and used to
 *  pre-fill the status-update form. `id` is the internal primary key
 *  (the route param) -- everything customer-facing already keys off
 *  `orderNumber` instead (see order-service.ts), but the admin route
 *  needs a stable id divorced from the human-facing order number, same
 *  reasoning as `/admin/products/[id]/edit` using the product's internal
 *  id rather than its slug. */
export interface AdminOrderDetailView {
  id: string;
  orderNumber: string;
  status: AdminOrderStatus;
  paymentMethod: 'cod' | 'bank_transfer';
  paymentStatus: AdminOrderPaymentStatus;
  currency: string;
  subtotalMinor: number;
  shippingFeeMinor: number;
  totalMinor: number;
  customerId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddressLine1: string;
  shippingWard: string | null;
  shippingDistrict: string | null;
  shippingProvince: string;
  shippingCountryCode: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  items: AdminOrderItemLine[];
}

/** What PATCH /api/admin/orders/:id accepts. Both fields are optional so
 *  an operator can change just status, just paymentStatus, or both in
 *  one save -- the API route treats an omitted field as "leave
 *  unchanged," never as "clear it" (there is no "clear" concept for
 *  either column; both are NOT NULL with a default in the DB). */
export interface AdminOrderStatusUpdateInput {
  status?: AdminOrderStatus;
  paymentStatus?: AdminOrderPaymentStatus;
}

/** Dashboard-only order summary, alongside the existing product stats.
 *  `pendingCount` is the actionable number (orders nobody has looked at
 *  yet); `paidRevenueMinor` is an all-time sum, deliberately NOT a
 *  "today"/"this week" figure -- computing a correct day boundary would
 *  need a real timezone decision (store timezone vs. server UTC vs.
 *  operator's own browser) that nothing else in this admin area has had
 *  to make yet, and an all-time total is unambiguous and still useful
 *  ("how much has this store actually been paid, ever") without
 *  guessing at one. A time-windowed figure can be added later once the
 *  timezone question is actually decided, rather than guessed here. */
export interface AdminOrderStats {
  totalOrders: number;
  pendingCount: number;
  paidRevenueMinor: number;
  /** The currency the revenue figure above is denominated in, or null if
   *  there are zero paid orders to sum (nothing to report a currency
   *  for). Every order in this schema defaults to 'VND' and nothing
   *  currently lets an operator create a multi-currency store, but this
   *  is read from the data rather than hardcoded so it stays correct if
   *  that ever changes. */
  currency: string | null;
}
