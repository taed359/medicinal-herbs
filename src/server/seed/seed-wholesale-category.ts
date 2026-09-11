/**
 * One-time creation of the "Bán sỉ" / wholesale-bulk category (id/slug
 * `wholesale`) -- products packaged in large containers (e.g. 20L drums)
 * for B2B buyers, priced by quote rather than a listed number (see
 * i18n `product.priceOnRequest` and ProductDetail.astro's price-row
 * fallback).
 *
 * `categories.slug` has no per-locale column -- one slug serves both the
 * /vi/products/<slug>/ and /zh/products/<slug>/ URL prefixes (see
 * schema.ts). An English, locale-neutral slug is the established
 * convention (see `natural-oils`); this category was briefly seeded under
 * the Vietnamese-word id/slug `ban-si`, which put Vietnamese words in the
 * /zh/ URL path. This script migrates that away (see the cleanup step
 * below) before seeding the real `wholesale` id/slug.
 *
 * Deliberately does NOT create any products, variants, pricing, images,
 * or content rows -- no real wholesale product data exists yet. Real
 * products go in through the existing admin product editor
 * (src/pages/admin/products/new.astro), which already supports entering
 * netQuantityValue/netQuantityUnit ('l'), containerType, and leaving price
 * blank (see AdminProductForm.astro / validate-admin-product-input.ts).
 * Mirrors the category-creation half of seed-natural-oils.ts.
 *
 * Safe to re-run: the migration step only fires while the old row still
 * exists, and the seed itself uses ON CONFLICT DO UPDATE keyed on id.
 */
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { categories, categoryTranslations, products } from '../../db/schema';

const OLD_CATEGORY_ID = 'ban-si';

const CATEGORY = {
  id: 'wholesale',
  slug: 'wholesale',
  // Copied verbatim from src/i18n/{vi,zh}.ts (`wholesale.eyebrow`).
  name: { vi: 'Hàng bán sỉ', zh: '批发商品' },
};

async function migrateAwayFromOldSlug() {
  const [oldRow] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.id, OLD_CATEGORY_ID))
    .limit(1);
  if (!oldRow) return; // nothing to migrate -- already clean or never seeded

  const [{ productCount }] = await db
    .select({ productCount: sql<number>`count(*)::int` })
    .from(products)
    .where(eq(products.categoryId, OLD_CATEGORY_ID));

  if (productCount > 0) {
    throw new Error(
      `Cannot migrate away from the old '${OLD_CATEGORY_ID}' category: ${productCount} product(s) still ` +
        `reference it. Reassign them to '${CATEGORY.id}' in the admin product editor first, then re-run this script.`
    );
  }

  console.log(`Removing old '${OLD_CATEGORY_ID}' category (0 products reference it)...`);
  // onDelete: 'cascade' on category_translations.category_id takes its
  // translations with it (see schema.ts).
  await db.delete(categories).where(eq(categories.id, OLD_CATEGORY_ID));
}

async function main() {
  await migrateAwayFromOldSlug();

  console.log(`Seeding category: ${CATEGORY.id}`);
  await db
    .insert(categories)
    .values({ id: CATEGORY.id, slug: CATEGORY.slug, sortOrder: 1, isPublished: true })
    .onConflictDoUpdate({ target: categories.id, set: { slug: CATEGORY.slug, isPublished: true } });

  for (const loc of ['vi', 'zh'] as const) {
    await db
      .insert(categoryTranslations)
      .values({ categoryId: CATEGORY.id, locale: loc, name: CATEGORY.name[loc] })
      .onConflictDoUpdate({
        target: [categoryTranslations.categoryId, categoryTranslations.locale],
        set: { name: CATEGORY.name[loc] },
      });
  }

  console.log('Seed complete. No products, variants, pricing, or images were created.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
