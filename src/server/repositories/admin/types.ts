/**
 * Admin write/read contract for Product CRUD (Phase 2). Mirrors the
 * separation established by src/server/repositories/types.ts (interface
 * here, concrete Postgres implementation under ./postgres/, wired
 * together in ./index.ts) but is its own interface -- not an extension of
 * the storefront `ProductRepository` -- because the shapes and the
 * "returns unpublished rows too" behavior are fundamentally admin-only;
 * see src/domain/admin-types.ts's doc comment for why they don't share a
 * type with the storefront's locale-resolved views.
 */
import type {
  AdminCategoryOption,
  AdminInventorySummary,
  AdminProductEditView,
  AdminProductListParams,
  AdminProductListResult,
  AdminProductWriteInput,
} from '../../../domain/admin-types';
import type {
  AdminOrderDetailView,
  AdminOrderListItem,
  AdminOrderListParams,
  AdminOrderListResult,
  AdminOrderStats,
  AdminOrderStatusUpdateInput,
} from '../../../domain/admin-order-types';

/**
 * Admin write/read contract for order management. Separate interface
 * from AdminProductRepository (same reasoning as admin-order-types.ts's
 * own top-of-file doc comment: orders and products share no query logic
 * or shapes) -- concrete Postgres implementation under
 * ./postgres/admin-order-repository.ts, wired together in ./index.ts.
 */
export interface AdminOrderRepository {
  /** Server-side filtered/sorted/paginated order listing -- see the
   *  Orders Admin Grid's doc comment on
   *  src/pages/admin/orders/index.astro. Every filter/sort value is
   *  validated by the caller before reaching here (see
   *  parseAdminOrderListParams); the repository itself additionally
   *  guards `sort` against a fixed column allow-list so a bad value can
   *  never become a raw ORDER BY column. */
  list(params: AdminOrderListParams): Promise<AdminOrderListResult>;

  /** Full detail for one order (by internal id, not orderNumber -- see
   *  AdminOrderDetailView's own doc comment), or null if it doesn't
   *  exist. Used to render /admin/orders/[id] and pre-fill its
   *  status-update form. */
  getById(id: string): Promise<AdminOrderDetailView | null>;

  /** Updates status and/or paymentStatus in place. Either field may be
   *  omitted (left unchanged) -- see AdminOrderStatusUpdateInput's doc
   *  comment. Throws if `id` doesn't exist. No general `update()` here
   *  the way products have one: every other order field is a historical
   *  snapshot from checkout (see schema.ts's own doc comment on
   *  order_items) and is never meant to be editable from admin. */
  updateStatus(id: string, input: AdminOrderStatusUpdateInput): Promise<void>;

  /** Dashboard-only summary (total orders, pending count, all-time paid
   *  revenue) -- see AdminOrderStats's own doc comment for why this is
   *  an all-time figure rather than a time-windowed one. */
  getStats(): Promise<AdminOrderStats>;

  /** Most-recently-placed orders, for the dashboard's "Recent orders"
   *  list -- same role as AdminProductRepository.list()'s pageSize: 5
   *  call on the product side, but its own dedicated method since order
   *  listing's sort/filter params would be overkill for "just the
   *  newest N". */
  listRecent(limit: number): Promise<AdminOrderListItem[]>;
}

export interface AdminProductRepository {
  /** All categories (published or not) -- populates the product form's
   *  category <select>. Admin CRUD for categories themselves is out of
   *  scope for this phase; this only reads what already exists. */
  listCategories(): Promise<AdminCategoryOption[]>;

  /** Low-stock summary across every variant's inventory row, for the
   *  dashboard. `hasTrackedVariants` is true only if at least one variant
   *  has BOTH quantity and lowStockThreshold set -- a row with just one of
   *  the two (or neither) can't be meaningfully compared, so it's not
   *  counted as "tracked." The dashboard uses this to decide whether to
   *  show the low-stock stat at all, rather than showing a misleading
   *  "0" when no product actually has inventory tracking configured. */
  getInventorySummary(): Promise<AdminInventorySummary>;

  /** Server-side filtered/sorted/paginated product listing -- see the
   *  Products Admin Grid's doc comment on src/pages/admin/products/
   *  index.astro. Every filter/sort value is validated by the caller
   *  before reaching here (see parseAdminProductListParams); the
   *  repository itself additionally guards `sort` against a fixed
   *  column allow-list (SORTABLE_COLUMNS) so a bad value can never
   *  become a raw ORDER BY column. */
  list(params: AdminProductListParams): Promise<AdminProductListResult>;

  /** Full editable state for one product, or null if `id` doesn't exist.
   *  Used to pre-fill the edit form. */
  getById(id: string): Promise<AdminProductEditView | null>;

  /** Returns true if another product already has this slug (optionally
   *  excluding `excludeId`, so an edit form can re-save a product's own
   *  unchanged slug without tripping its own uniqueness check). */
  slugExists(slug: string, excludeId?: string): Promise<boolean>;

  /** Creates a new product (+ its VI/ZH translations, primary image if
   *  provided, and every repeatable child record -- benefits, warnings,
   *  certifications, gallery images, variants+pricing+inventory --
   *  present in the payload) as one transaction. Returns the generated
   *  id. */
  create(input: AdminProductWriteInput): Promise<{ id: string }>;

  /** Updates an existing product in place, as one transaction --
   *  including replacing its benefits/warnings/certifications/gallery
   *  images/variants to match the payload's arrays exactly (see
   *  AdminProductChildInput's doc comment: this is a full replace-set,
   *  not a diff/patch API). A variant's pricing is the one exception to
   *  "replace-set": its current effective price row is updated in place
   *  rather than replaced (see AdminProductVariantInput's doc comment).
   *  Throws if `id` doesn't exist. */
  update(id: string, input: AdminProductWriteInput): Promise<void>;

  /** Hard-deletes a product. Every child table (translations, images,
   *  variants, pricing, inventory, benefits, warnings, certifications)
   *  references products.id with `onDelete: 'cascade'` (see
   *  src/db/schema.ts), so this one statement is enough -- Postgres
   *  cascades the rest. */
  delete(id: string): Promise<void>;

  /** Atomically deletes every product whose id is in `ids` -- one
   *  `DELETE ... WHERE id IN (...)` statement, all-or-nothing (a single
   *  DELETE statement is already atomic under Postgres's normal
   *  statement-level atomicity; there is no multi-statement sequence
   *  here that would need an explicit transaction wrapper). Callers are
   *  responsible for validating `ids` against the DB first (see the
   *  bulk-delete route) so this never silently "succeeds" on ids that
   *  never existed. Returns the ids that were actually deleted. */
  deleteMany(ids: string[]): Promise<{ deleted: string[] }>;
}
