/**
 * Parses/validates the Products Admin Grid's URL query string into a safe
 * AdminProductListParams. This is the ONLY place a raw query-string value
 * is allowed to influence the SQL query -- every field here is either
 * coerced to a known-safe type or falls back to a default; nothing here
 * is ever passed through to the repository as a raw string that could
 * become a column name or SQL fragment (see SORTABLE_COLUMNS in the
 * Postgres repository for the second half of that guarantee).
 */
import type {
  AdminProductFeaturedFilter,
  AdminProductListParams,
  AdminProductSortColumn,
  AdminProductSortDirection,
  AdminProductStatusFilter,
} from '../../domain/admin-types';

export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 25;

const SORT_COLUMNS = new Set<AdminProductSortColumn>(['name', 'updatedAt', 'sortOrder']);
const STATUS_VALUES = new Set<AdminProductStatusFilter>(['all', 'published', 'draft']);
const FEATURED_VALUES = new Set<AdminProductFeaturedFilter>(['all', 'featured', 'not-featured']);

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return n;
}

export function parseAdminProductListParams(searchParams: URLSearchParams): AdminProductListParams {
  const page = parsePositiveInt(searchParams.get('page'), 1);

  const rawPageSize = parsePositiveInt(searchParams.get('limit'), DEFAULT_PAGE_SIZE);
  const pageSize = (PAGE_SIZE_OPTIONS as readonly number[]).includes(rawPageSize) ? rawPageSize : DEFAULT_PAGE_SIZE;

  // Deliberately NOT .trim()'d here: `search` round-trips straight back
  // into the search <input>'s `value` on the next page load (see
  // buildHref()/the input's `value={params.search}` in
  // src/pages/admin/products/index.astro), so trimming it here would
  // silently eat a trailing space the user is still actively typing
  // after (e.g. typing "Dầu " then continuing to "Dầu dừa"). The
  // repository already does its own `.trim()` immediately before
  // building the ILIKE pattern (see admin-product-repository.ts's
  // list()), so the query itself was never affected by whitespace --
  // only the UI echo was. Effectively-empty (whitespace-only) search is
  // handled separately via a trimmed check wherever "is a filter active"
  // needs to be decided (see hasFilters in products/index.astro) --
  // that trimmed check is local to that decision and never mutates this
  // value.
  const search = (searchParams.get('q') ?? '').slice(0, 200);

  const categoryId = searchParams.get('category');

  const rawStatus = searchParams.get('status');
  const status: AdminProductStatusFilter =
    rawStatus && STATUS_VALUES.has(rawStatus as AdminProductStatusFilter)
      ? (rawStatus as AdminProductStatusFilter)
      : 'all';

  const rawFeatured = searchParams.get('featured');
  const featured: AdminProductFeaturedFilter =
    rawFeatured && FEATURED_VALUES.has(rawFeatured as AdminProductFeaturedFilter)
      ? (rawFeatured as AdminProductFeaturedFilter)
      : 'all';

  const rawSort = searchParams.get('sort');
  const sort: AdminProductSortColumn =
    rawSort && SORT_COLUMNS.has(rawSort as AdminProductSortColumn) ? (rawSort as AdminProductSortColumn) : 'updatedAt';

  const rawDirection = searchParams.get('direction');
  const direction: AdminProductSortDirection = rawDirection === 'asc' ? 'asc' : 'desc';

  return {
    page,
    pageSize,
    search,
    categoryId: categoryId && categoryId.trim() ? categoryId.trim() : null,
    status,
    featured,
    sort,
    direction,
  };
}
