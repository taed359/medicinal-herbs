/**
 * Drizzle schema — single source of truth for both the generated SQL
 * migrations (`npm run db:generate`) and the TypeScript types used by the
 * repository layer. Mirrors the schema approved in the architecture audit
 * 1:1 — see product-data-architecture-audit.md §4.
 *
 * Naming: snake_case column names (Postgres convention) via drizzle's
 * explicit column-name argument; camelCase on the JS/TS side.
 */
import {
  pgTable,
  text,
  integer,
  bigint,
  numeric,
  boolean,
  timestamp,
  date,
  primaryKey,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const locale = () => text('locale');

// ---------------------------------------------------------------------------
// categories
// ---------------------------------------------------------------------------
export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  parentId: text('parent_id'),
  sortOrder: integer('sort_order').notNull().default(0),
  isPublished: boolean('is_published').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_categories_parent').on(table.parentId),
]);

// ---------------------------------------------------------------------------
// category_translations
// ---------------------------------------------------------------------------
export const categoryTranslations = pgTable('category_translations', {
  categoryId: text('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  locale: locale().notNull(),
  name: text('name').notNull(),
  description: text('description'),
}, (table) => [
  primaryKey({ columns: [table.categoryId, table.locale] }),
  check('locale_check', sql`${table.locale} IN ('vi', 'zh')`),
]);

// ---------------------------------------------------------------------------
// products
// ---------------------------------------------------------------------------
export const products = pgTable('products', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  categoryId: text('category_id').notNull().references(() => categories.id),
  isFeatured: boolean('is_featured').notNull().default(false),
  isPublished: boolean('is_published').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  // --- Natural Oil attribute additions (schema/repository plumbing only —
  // see natural-oil-product-attribute-audit.md §4/§5. All nullable; no
  // data seeded until real product facts exist). ---
  botanicalName: text('botanical_name'),
  countryOfOriginCode: text('country_of_origin_code'),
  extractionMethod: text('extraction_method'),
  manufacturerName: text('manufacturer_name'),
}, (table) => [
  index('idx_products_category').on(table.categoryId),
  index('idx_products_featured').on(table.isFeatured).where(sql`${table.isFeatured} = true`),
  index('idx_products_published').on(table.isPublished).where(sql`${table.isPublished} = true`),
]);

// ---------------------------------------------------------------------------
// product_translations
// ---------------------------------------------------------------------------
export const productTranslations = pgTable('product_translations', {
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  locale: locale().notNull(),
  name: text('name').notNull(),
  shortDescription: text('short_description'),
  description: text('description'),
  ingredients: text('ingredients'),
  usageInstructions: text('usage_instructions'),
}, (table) => [
  primaryKey({ columns: [table.productId, table.locale] }),
  check('locale_check', sql`${table.locale} IN ('vi', 'zh')`),
]);

// ---------------------------------------------------------------------------
// product_benefits
// ---------------------------------------------------------------------------
export const productBenefits = pgTable('product_benefits', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  locale: locale().notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  text: text('text').notNull(),
  // Structural guardrail against disease-claim drift (see attribute audit
  // §1.2/§N): 'marketing' is the safe default for existing/new rows with
  // no explicit claim_type. 'structure_function' is a real, valid value —
  // deliberately never assigned by the seed script.
  claimType: text('claim_type').notNull().default('marketing'),
}, (table) => [
  index('idx_product_benefits_product').on(table.productId, table.locale, table.sortOrder),
  check('locale_check', sql`${table.locale} IN ('vi', 'zh')`),
  check('product_benefits_claim_type_check', sql`${table.claimType} IN ('factual', 'marketing', 'structure_function')`),
]);

// ---------------------------------------------------------------------------
// product_images
// ---------------------------------------------------------------------------
export const productImages = pgTable('product_images', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  role: text('role').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_product_images_one_primary').on(table.productId).where(sql`${table.role} = 'primary'`),
  index('idx_product_images_product').on(table.productId, table.sortOrder),
  check('product_images_role_check', sql`${table.role} IN ('primary', 'gallery', 'thumbnail')`),
]);

// ---------------------------------------------------------------------------
// product_image_translations
// ---------------------------------------------------------------------------
export const productImageTranslations = pgTable('product_image_translations', {
  imageId: text('image_id').notNull().references(() => productImages.id, { onDelete: 'cascade' }),
  locale: locale().notNull(),
  alt: text('alt').notNull(),
}, (table) => [
  primaryKey({ columns: [table.imageId, table.locale] }),
  check('locale_check', sql`${table.locale} IN ('vi', 'zh')`),
]);

// ---------------------------------------------------------------------------
// product_variants
// ---------------------------------------------------------------------------
export const productVariants = pgTable('product_variants', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  sku: text('sku').notNull().unique(),
  isDefault: boolean('is_default').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  // --- Natural Oil packaging/identity additions (nullable; unseeded) ---
  netQuantityValue: numeric('net_quantity_value'),
  netQuantityUnit: text('net_quantity_unit'),
  containerType: text('container_type'),
  gtin: text('gtin'),
}, (table) => [
  uniqueIndex('idx_variants_one_default').on(table.productId).where(sql`${table.isDefault} = true`),
  index('idx_variants_product').on(table.productId),
  check('product_variants_net_quantity_unit_check', sql`${table.netQuantityUnit} IN ('ml', 'l', 'g', 'fl_oz')`),
]);

// ---------------------------------------------------------------------------
// product_variant_translations
// ---------------------------------------------------------------------------
export const productVariantTranslations = pgTable('product_variant_translations', {
  variantId: text('variant_id').notNull().references(() => productVariants.id, { onDelete: 'cascade' }),
  locale: locale().notNull(),
  label: text('label').notNull(),
}, (table) => [
  primaryKey({ columns: [table.variantId, table.locale] }),
  check('locale_check', sql`${table.locale} IN ('vi', 'zh')`),
]);

// ---------------------------------------------------------------------------
// pricing (time-versioned; "current" price = latest row where
// effective_from <= now() < effective_to (or effective_to IS NULL))
// ---------------------------------------------------------------------------
export const pricing = pgTable('pricing', {
  id: text('id').primaryKey(),
  variantId: text('variant_id').notNull().references(() => productVariants.id, { onDelete: 'cascade' }),
  priceMinor: bigint('price_minor', { mode: 'number' }).notNull(),
  compareAtMinor: bigint('compare_at_minor', { mode: 'number' }),
  currency: text('currency').notNull().default('VND'),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull().defaultNow(),
  effectiveTo: timestamp('effective_to', { withTimezone: true }),
}, (table) => [
  index('idx_pricing_variant_active').on(table.variantId, table.effectiveFrom),
]);

// ---------------------------------------------------------------------------
// inventory
// ---------------------------------------------------------------------------
export const inventory = pgTable('inventory', {
  variantId: text('variant_id').primaryKey().references(() => productVariants.id, { onDelete: 'cascade' }),
  quantity: integer('quantity'),
  lowStockThreshold: integer('low_stock_threshold'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// product_warnings — deliberately mirrors product_benefits' shape exactly
// (see attribute audit §2.E / §5). Unseeded: no product-specific safety
// copy exists in the repository yet.
// ---------------------------------------------------------------------------
export const productWarnings = pgTable('product_warnings', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  locale: locale().notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  text: text('text').notNull(),
}, (table) => [
  index('idx_product_warnings_product').on(table.productId, table.locale, table.sortOrder),
  check('product_warnings_locale_check', sql`${table.locale} IN ('vi', 'zh')`),
]);

// ---------------------------------------------------------------------------
// product_certifications — no locale column: cert_type is a controlled
// vocabulary whose display label is translated in the UI/i18n layer (same
// pattern as product_images.role), not stored per-locale here. Unseeded:
// no real certificate exists in the repository yet.
// ---------------------------------------------------------------------------
export const productCertifications = pgTable('product_certifications', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  certType: text('cert_type').notNull(),
  issuingBody: text('issuing_body'),
  certificateNumber: text('certificate_number'),
  validFrom: date('valid_from'),
  validTo: date('valid_to'),
}, (table) => [
  index('idx_product_certifications_product').on(table.productId),
]);

// ---------------------------------------------------------------------------
// Admin auth (Better Auth) — Phase 1 (Admin Foundation)
//
// These 4 tables are defined directly in our own Drizzle schema (not
// generated by the Better Auth CLI) so migrations stay in our normal
// reviewed drizzle-kit flow. Table names use our own `admin_` prefix;
// column names/types follow Better Auth's own canonical field set exactly
// (see better-auth@1.7.2's accountSchema/sessionSchema/userSchema/
// verificationSchema) so the Drizzle adapter's `schema` mapping
// (src/server/auth/auth.ts) can point straight at these tables.
//
// `issuer` on admin_accounts is a real Better Auth 1.7.2 core field, not an
// invented one — Better Auth computes it as `local:<providerId>` for
// non-OAuth accounts (e.g. `local:credential` for email/password) via its
// own `createLocalAccountIssuer()` helper, and the natural uniqueness key
// for an account is (issuer, accountId), not (providerId, accountId) — see
// AccountKey in @better-auth/core. `.default('local:credential')` exists
// only as a safety net (this project has exactly one provider today) so
// the NOT NULL column can never block an insert that doesn't set it
// explicitly; every real write (Better Auth itself, and our seed script)
// always sets it explicitly.
// ---------------------------------------------------------------------------
export const adminUsers = pgTable('admin_users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const adminSessions = pgTable('admin_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => adminUsers.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_admin_sessions_user').on(table.userId),
]);

export const adminAccounts = pgTable('admin_accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => adminUsers.id, { onDelete: 'cascade' }),
  issuer: text('issuer').notNull().default('local:credential'),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  idToken: text('id_token'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_admin_accounts_issuer_account').on(table.issuer, table.accountId),
  index('idx_admin_accounts_user').on(table.userId),
]);

export const adminVerifications = pgTable('admin_verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_admin_verifications_identifier').on(table.identifier),
]);

// ---------------------------------------------------------------------------
// Customer auth (Better Auth) — Phase 1 (Customer Authentication).
//
// A SECOND, fully independent Better Auth instance (src/server/auth/
// customer-auth.ts) — never the admin one. Physically separate tables, same
// shape/convention as admin_* above (see that block's own doc comment for
// why column names/types follow Better Auth's canonical field set). This is
// a deliberate security boundary, not duplication for its own sake: a bug
// anywhere in public customer registration/login can never touch admin_*
// rows, because no code path here ever references them.
// ---------------------------------------------------------------------------
export const customerUsers = pgTable('customer_users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const customerSessions = pgTable('customer_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => customerUsers.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_customer_sessions_user').on(table.userId),
]);

export const customerAccounts = pgTable('customer_accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => customerUsers.id, { onDelete: 'cascade' }),
  issuer: text('issuer').notNull().default('local:credential'),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  idToken: text('id_token'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idx_customer_accounts_issuer_account').on(table.issuer, table.accountId),
  index('idx_customer_accounts_user').on(table.userId),
]);

export const customerVerifications = pgTable('customer_verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_customer_verifications_identifier').on(table.identifier),
]);

// ---------------------------------------------------------------------------
// customer_profiles — the auth/business-domain boundary. customer_users
// (above) is entirely Better-Auth-owned; nothing app-specific belongs on it.
// This table is where that ever grows (display name overrides, phone,
// marketing preferences, etc.) — deliberately near-empty for Phase 1 (no
// requirement exists yet for any of those fields), but created eagerly for
// every customer at signup (see customer-auth.ts's databaseHooks.user.create
// .after) so no backfill migration is ever needed once a real field shows
// up. 1:1 via a shared primary key (customerId), not a separate id + unique
// index — there is exactly one profile per customer, ever.
// ---------------------------------------------------------------------------
export const customerProfiles = pgTable('customer_profiles', {
  customerId: text('customer_id').primaryKey().references(() => customerUsers.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// rateLimit — Better Auth's own canonical model for `rateLimit.storage:
// 'database'` (verified against the installed better-auth@1.7.2's
// createDatabaseStorageWrapper and @better-auth/core's rateLimitSchema:
// exactly `key`/`count`/`lastRequest`, ms-epoch). Used only by the customer
// Better Auth instance's built-in IP+path limiter — admin's rate limiter is
// unchanged (still in-memory, out of scope for this phase). `lastRequest`
// is bigint/number-mode, matching this project's existing convention for
// large plain-number columns (see pricing.priceMinor).
// ---------------------------------------------------------------------------
export const rateLimit = pgTable('rate_limit', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull().default(0),
  lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
});

// ---------------------------------------------------------------------------
// customer_login_attempts — application-owned, NOT part of Better Auth's
// schema/adapter mapping. Backs the per-account (email) sign-in limiter
// required because Better Auth's own `rateLimit.customRules` can only
// adjust the window/max of its existing IP+path bucket, not key by email
// (verified against the installed rate-limiter source — no public API
// supports an email-keyed bucket). Queried directly via Drizzle from
// customer-auth.ts's `hooks.before`, never through Better Auth's adapter —
// this table has no relationship to Better Auth's own `rateLimit` model
// above beyond incidentally sharing a similar key/count/lastRequest shape.
// ---------------------------------------------------------------------------
export const customerLoginAttempts = pgTable('customer_login_attempts', {
  email: text('email').primaryKey(),
  count: integer('count').notNull().default(0),
  windowStartedAt: timestamp('window_started_at', { withTimezone: true }).notNull().defaultNow(),
});
