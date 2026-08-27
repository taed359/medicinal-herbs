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
