/**
 * Admin-only read/write shapes — Phase 2 (Product CRUD).
 *
 * Deliberately separate from src/domain/types.ts: those types are
 * locale-RESOLVED (one string per field, already picked for a single
 * storefront visitor) and read-only. The admin product form needs the
 * OPPOSITE shape — both VI and ZH values side by side in one screen so an
 * operator can edit them together — plus write-only concerns (which rows
 * to insert/update) that a storefront page never needs. Mixing these into
 * src/domain/types.ts would blur a distinction the rest of the codebase
 * (see src/server/repositories/types.ts's own doc comment) is careful to
 * keep.
 */

export interface AdminCategoryOption {
  id: string;
  slug: string;
  /** VI name only -- enough to label a <select> option; the admin UI
   *  itself is English-chrome/VI+ZH-content, not a third locale. */
  name: string;
}

/** Dashboard-only summary of inventory tracking across all variants. See
 *  AdminProductRepository.getInventorySummary's doc comment for exactly
 *  what "tracked" means. */
export interface AdminInventorySummary {
  hasTrackedVariants: boolean;
  lowStockCount: number;
}

export interface AdminProductListItem {
  id: string;
  slug: string;
  categoryId: string;
  categoryName: string;
  nameVi: string;
  nameZh: string;
  /** Single display name for the grid's Name column: VI if present,
   *  else ZH, else the slug -- see the admin grid's locale-display
   *  decision (no admin-language-preference system introduced). */
  displayName: string;
  /** Default variant's SKU, or null if the product has no variants yet
   *  (a real possibility -- Core-fields-only products may not have any
   *  variant/pricing/inventory rows). Never invented. */
  sku: string | null;
  /** Current price (respecting pricing.effectiveFrom/effectiveTo) of the
   *  default variant, or null if there is no variant, or no variant has
   *  a currently-effective price row. */
  priceMinor: number | null;
  currency: string | null;
  /** Default variant's inventory quantity, or null if there is no
   *  variant or no inventory row for it. */
  inventoryQuantity: number | null;
  imageUrl: string | null;
  imageAlt: string | null;
  isFeatured: boolean;
  isPublished: boolean;
  sortOrder: number;
  updatedAt: string; // ISO 8601
}

/** The primary product image as edited in the admin form: one URL, one
 *  alt string per locale. Width/height are never operator-entered -- see
 *  src/server/lib/probe-image.ts -- they're measured server-side from the
 *  actual image bytes so product_images never gets an invented value in
 *  its NOT NULL width/height columns. */
export interface AdminProductImageInput {
  url: string;
  altVi: string;
  altZh: string;
}

/** One product_benefits row as edited in the admin form. `id: null` means
 *  "new row -- the repository generates an id"; a non-null id must match
 *  an existing row's id (or it's silently a no-op insert-with-that-id,
 *  which the repository treats as "create this row with this id" -- see
 *  replaceBenefits()). sortOrder is recomputed from on-screen order at
 *  submit time, never hand-typed by the operator. */
export interface AdminProductBenefitInput {
  id: string | null;
  locale: 'vi' | 'zh';
  text: string;
  claimType: 'factual' | 'marketing' | 'structure_function';
  sortOrder: number;
}

/** One product_warnings row -- same shape/semantics as
 *  AdminProductBenefitInput minus claimType (product_warnings has no such
 *  column). */
export interface AdminProductWarningInput {
  id: string | null;
  locale: 'vi' | 'zh';
  text: string;
  sortOrder: number;
}

/** One product_certifications row. No locale, no sortOrder -- neither
 *  column exists on product_certifications (see src/db/schema.ts).
 *  certType is free text (no DB/app-level enum exists -- see
 *  formatCertType() in src/lib/product-metadata-labels.ts, which just
 *  title-cases whatever string is stored), never invented into a
 *  fabricated closed list here. */
export interface AdminProductCertificationInput {
  id: string | null;
  certType: string;
  issuingBody: string | null;
  certificateNumber: string | null;
  /** ISO date (YYYY-MM-DD), or null. */
  validFrom: string | null;
  validTo: string | null;
}

/** One non-primary (role: 'gallery') product_images row, edited the same
 *  URL-based way as the existing primary image field -- width/height are
 *  never operator-entered, they're measured server-side (see
 *  probe-image.ts) before the row is written. */
export interface AdminProductGalleryImageInput {
  id: string | null;
  url: string;
  altVi: string;
  altZh: string;
  sortOrder: number;
}

/** Payload for both create and update. `image: null` means "leave
 *  whatever primary image exists today untouched" on update (or "no
 *  image yet" on create) -- it's the caller's job to pass a real
 *  AdminProductImageInput only when the operator actually changed the
 *  image URL/alt text, so re-saving a form never re-probes/re-writes an
 *  unchanged image.
 *
 *  benefits/warnings/certifications/galleryImages are each a full
 *  REPLACE-SET: the array passed here becomes the row's complete set of
 *  children of that type after save (rows missing from the array are
 *  deleted, rows with a matching existing id are updated in place, rows
 *  with `id: null` are inserted new) -- see replaceBenefits() and
 *  siblings in the Postgres repository. This mirrors how the admin form
 *  actually edits these lists (the whole section is always resubmitted),
 *  and keeps the write model simple -- no separate add/remove endpoints. */
export interface AdminProductInput {
  slug: string;
  categoryId: string;
  isFeatured: boolean;
  isPublished: boolean;
  sortOrder: number;
  nameVi: string;
  nameZh: string;
  shortDescriptionVi: string | null;
  shortDescriptionZh: string | null;
  descriptionVi: string | null;
  descriptionZh: string | null;
  /** product_translations.ingredients -- editable per locale, optional. */
  ingredientsVi: string | null;
  ingredientsZh: string | null;
  /** product_translations.usage_instructions -- editable per locale, optional. */
  usageVi: string | null;
  usageZh: string | null;
  /** products.botanical_name/country_of_origin_code/extraction_method/
   *  manufacturer_name -- the "Natural Oil attribute additions" columns
   *  (see src/db/schema.ts's own comment on `products`). All nullable in
   *  the DB and all genuinely optional here -- never invented if empty. */
  botanicalName: string | null;
  countryOfOriginCode: string | null;
  extractionMethod: string | null;
  manufacturerName: string | null;
  image: AdminProductImageInput | null;
}

/** Three-state action for a variant's price, distinguishing "the operator
 *  didn't touch this field" from "the operator explicitly asked to remove
 *  the price" -- collapsing those into one falsy value would make a blank
 *  price input ambiguous between the two. There is no orders/checkout
 *  table anywhere in this schema (verified against src/db/schema.ts) and
 *  nothing references a `pricing` row by id, so removing the current
 *  effective row is safe -- every consumer (storefront ProductDetail,
 *  admin grid, this form) already treats "no current price" as a normal,
 *  handled state, not an error.
 *  - `null`: untouched -- leave whatever pricing exists as-is.
 *  - `{ action: 'clear' }`: delete the variant's current effective
 *    pricing row (a no-op if none exists). Never touches effectiveFrom/
 *    effectiveTo on any other row -- there is no price history here to
 *    preserve or rewrite, just "does a current price exist or not."
 *  - `{ action: 'set', ... }`: update the current effective pricing row
 *    in place, or insert one if none is active (see replaceVariants()'s
 *    doc comment on the Postgres repository for why "in place," not a
 *    new effective-dated version). */
export type AdminProductVariantPriceInput =
  | { action: 'clear' }
  | { action: 'set'; priceMinor: number; compareAtMinor: number | null; currency: string }
  | null;

/** One product_variants row as edited in the admin form, plus its 1:1
 *  pricing/inventory data folded in (both are keyed by variantId in the
 *  DB, so there's no separate array to reconcile). See
 *  AdminProductVariantPriceInput for price's three states.
 *  `inventory: null` means "leave the existing inventory row (if any)
 *  untouched" -- distinct from `{ quantity: null, lowStockThreshold: null
 *  }`, which explicitly clears both to unknown. */
export interface AdminProductVariantInput {
  id: string | null;
  sku: string;
  isDefault: boolean;
  labelVi: string | null;
  labelZh: string | null;
  netQuantityValue: number | null;
  netQuantityUnit: 'ml' | 'l' | 'g' | 'fl_oz' | null;
  containerType: string | null;
  gtin: string | null;
  sortOrder: number;
  price: AdminProductVariantPriceInput;
  inventory: { quantity: number | null; lowStockThreshold: number | null } | null;
}

/** The repeatable-child-record part of a create/update payload, kept as a
 *  separate type (rather than folded into AdminProductInput itself)
 *  specifically so AdminProductEditView -- which extends AdminProductInput
 *  for its scalar/image fields -- can go on declaring its OWN `benefits`/
 *  `warnings`/`certifications` as the read-only *Summary[] shapes without
 *  a name collision against a differently-shaped *Input[] property. */
export interface AdminProductChildInput {
  benefits: AdminProductBenefitInput[];
  warnings: AdminProductWarningInput[];
  certifications: AdminProductCertificationInput[];
  galleryImages: AdminProductGalleryImageInput[];
  variants: AdminProductVariantInput[];
}

/** What create()/update() actually accept: core fields + every
 *  repeatable-child-record replace-set. */
export type AdminProductWriteInput = AdminProductInput & AdminProductChildInput;

/** What the edit form is pre-filled from. `imageId` is the existing
 *  primary product_images row id (if any) -- the repository needs it to
 *  UPDATE that row in place on save rather than inserting a second
 *  "primary" image and violating idx_product_images_one_primary. */
/** Pre-fill shape for the edit form's repeatable child-record sections
 *  (variants+pricing+inventory, benefits, warnings, certifications,
 *  images) -- all of these ARE editable (see AdminProductChildInput for
 *  the corresponding write shapes); this is just what getById() reads
 *  back to populate the form. Never fabricated: an empty array means the
 *  product genuinely has none of that data yet, not that the field is
 *  unsupported. */
export interface AdminProductVariantSummary {
  id: string;
  sku: string;
  isDefault: boolean;
  labelVi: string | null;
  labelZh: string | null;
  netQuantityValue: number | null;
  netQuantityUnit: string | null;
  containerType: string | null;
  gtin: string | null;
  priceMinor: number | null;
  compareAtMinor: number | null;
  currency: string | null;
  inventoryQuantity: number | null;
  lowStockThreshold: number | null;
}

export interface AdminProductBenefitSummary {
  id: string;
  locale: 'vi' | 'zh';
  text: string;
  claimType: string;
  sortOrder: number;
}

export interface AdminProductWarningSummary {
  id: string;
  locale: 'vi' | 'zh';
  text: string;
  sortOrder: number;
}

export interface AdminProductCertificationSummary {
  id: string;
  certType: string;
  issuingBody: string | null;
  certificateNumber: string | null;
  validFrom: string | null;
  validTo: string | null;
}

export interface AdminProductImageSummary {
  id: string;
  url: string;
  role: string;
  sortOrder: number;
  altVi: string | null;
  altZh: string | null;
  width: number;
  height: number;
}

export interface AdminProductEditView extends AdminProductInput {
  id: string;
  imageId: string | null;
  createdAt: string;
  updatedAt: string;
  variants: AdminProductVariantSummary[];
  benefits: AdminProductBenefitSummary[];
  warnings: AdminProductWarningSummary[];
  certifications: AdminProductCertificationSummary[];
  images: AdminProductImageSummary[];
}

export interface AdminProductListResult {
  items: AdminProductListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Products Admin Grid -- list query params / richer list item / paginated
// result. Kept separate from the simpler AdminProductListItem/
// AdminProductListResult above only in the sense that those two types are
// now EXTENDED in place (grid columns are additive: sku/price/inventory/
// image/displayName), not replaced, so getById()/create()/update() and
// every other consumer of AdminProductInput/AdminProductEditView above are
// untouched.
// ---------------------------------------------------------------------------

/** Columns the grid can sort by. Deliberately a closed set -- the
 *  repository maps each value to a real, known-safe column expression
 *  (see SORTABLE_COLUMNS in the Postgres repository); a raw column name
 *  from the URL is never accepted. */
export type AdminProductSortColumn = 'name' | 'updatedAt' | 'sortOrder';

export type AdminProductSortDirection = 'asc' | 'desc';

export type AdminProductStatusFilter = 'all' | 'published' | 'draft';

export type AdminProductFeaturedFilter = 'all' | 'featured' | 'not-featured';

export interface AdminProductListParams {
  /** 1-based. */
  page: number;
  pageSize: number;
  /** Trimmed; '' means "no search". Matched against both VI and ZH
   *  product names. */
  search: string;
  /** null means "all categories". */
  categoryId: string | null;
  status: AdminProductStatusFilter;
  featured: AdminProductFeaturedFilter;
  sort: AdminProductSortColumn;
  direction: AdminProductSortDirection;
}
