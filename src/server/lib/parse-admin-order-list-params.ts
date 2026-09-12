/**
 * Parses/validates the Orders Admin Grid's URL query string into a safe
 * AdminOrderListParams -- same discipline as
 * parse-admin-product-list-params.ts: every field is either coerced to a
 * known-safe type or falls back to a default, nothing here is ever
 * passed through to the repository as a raw string that could become a
 * column name or SQL fragment.
 */
import { ADMIN_ORDER_STATUSES, ADMIN_ORDER_PAYMENT_STATUSES } from '../../domain/admin-order-types';
import type {
  AdminOrderListParams,
  AdminOrderPaymentStatusFilter,
  AdminOrderSortColumn,
  AdminOrderSortDirection,
  AdminOrderStatusFilter,
} from '../../domain/admin-order-types';

export const ORDER_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 25;

const SORT_COLUMNS = new Set<AdminOrderSortColumn>(['createdAt', 'totalMinor']);
const STATUS_VALUES = new Set<string>(ADMIN_ORDER_STATUSES);
const PAYMENT_STATUS_VALUES = new Set<string>(ADMIN_ORDER_PAYMENT_STATUSES);

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return n;
}

export function parseAdminOrderListParams(searchParams: URLSearchParams): AdminOrderListParams {
  const page = parsePositiveInt(searchParams.get('page'), 1);

  const rawPageSize = parsePositiveInt(searchParams.get('limit'), DEFAULT_PAGE_SIZE);
  const pageSize = (ORDER_PAGE_SIZE_OPTIONS as readonly number[]).includes(rawPageSize) ? rawPageSize : DEFAULT_PAGE_SIZE;

  // Not trimmed here, same reasoning as the Products Grid's own search
  // param: it round-trips straight back into the search <input>'s value
  // on the next page load, so trimming here would eat a trailing space
  // the operator is still typing. The repository trims immediately
  // before building the ILIKE pattern.
  const search = (searchParams.get('q') ?? '').slice(0, 200);

  const rawStatus = searchParams.get('status');
  const status: AdminOrderStatusFilter =
    rawStatus && STATUS_VALUES.has(rawStatus) ? (rawStatus as AdminOrderStatusFilter) : 'all';

  const rawPaymentStatus = searchParams.get('payment');
  const paymentStatus: AdminOrderPaymentStatusFilter =
    rawPaymentStatus && PAYMENT_STATUS_VALUES.has(rawPaymentStatus)
      ? (rawPaymentStatus as AdminOrderPaymentStatusFilter)
      : 'all';

  const rawSort = searchParams.get('sort');
  const sort: AdminOrderSortColumn =
    rawSort && SORT_COLUMNS.has(rawSort as AdminOrderSortColumn) ? (rawSort as AdminOrderSortColumn) : 'createdAt';

  const rawDirection = searchParams.get('direction');
  const direction: AdminOrderSortDirection = rawDirection === 'asc' ? 'asc' : 'desc';

  return { page, pageSize, search, status, paymentStatus, sort, direction };
}
