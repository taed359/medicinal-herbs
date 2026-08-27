/**
 * One-time backfill of the 10 existing Natural Oils products from
 * src/data/products/natural-oils.ts into the database.
 *
 * Per the approved migration mapping (architecture audit §8), this seeds
 * ONLY the fields that are real, existing data today:
 *   - product id, slug
 *   - VI name, ZH name
 *   - category (id + translated label, copied from src/i18n/{vi,zh}.ts)
 *   - featured flag
 *   - published state (all 10 are live today, so seeded as published)
 *
 * It deliberately does NOT create:
 *   - any product_variants / pricing / inventory rows (no real price,
 *     SKU, or stock data exists yet — do not invent it)
 *   - any product_images rows (all 10 currently share one placeholder
 *     asset; per audit §7, that must not become 10 fake DB rows — the
 *     placeholder stays a presentation-layer fallback, see
 *     src/lib/product-image-fallback.ts)
 *   - any product_benefits / description / ingredients / usage content
 *     (none of this exists as real data and none is seeded here)
 *
 * Safe to re-run: every insert uses ON CONFLICT DO UPDATE, keyed on the
 * same natural keys used in src/data/products/natural-oils.ts today.
 */
import { db } from '../db/client';
import { categories, categoryTranslations, products, productTranslations } from '../../db/schema';

const CATEGORY = {
  id: 'natural-oils',
  slug: 'natural-oils',
  // Copied verbatim from src/i18n/vi.ts and src/i18n/zh.ts
  // (`naturalOils.eyebrow`) — real, existing i18n copy, not invented.
  name: { vi: 'Dầu thực vật tự nhiên', zh: '天然植物油' },
};

// Copied verbatim from src/data/products/natural-oils.ts. Only the fields
// listed in the module doc comment above are carried over.
const NATURAL_OILS_SEED = [
  { id: 'natural-oils:coconut-oil', slug: 'coconut-oil', featured: true, vi: 'Dầu dừa', zh: '椰子油' },
  { id: 'natural-oils:rice-bran-oil', slug: 'rice-bran-oil', featured: false, vi: 'Dầu cám gạo', zh: '米糠油' },
  { id: 'natural-oils:peanut-oil', slug: 'peanut-oil', featured: false, vi: 'Dầu đậu phộng', zh: '花生油' },
  { id: 'natural-oils:sunflower-oil', slug: 'sunflower-oil', featured: true, vi: 'Dầu hướng dương', zh: '葵花籽油' },
  { id: 'natural-oils:soybean-oil', slug: 'soybean-oil', featured: false, vi: 'Dầu đậu nành', zh: '大豆油' },
  { id: 'natural-oils:canola-oil', slug: 'canola-oil', featured: false, vi: 'Dầu cải / Canola', zh: '菜籽油' },
  { id: 'natural-oils:palm-oil', slug: 'palm-oil', featured: false, vi: 'Dầu cọ', zh: '棕榈油' },
  { id: 'natural-oils:sesame-oil', slug: 'sesame-oil', featured: true, vi: 'Dầu mè', zh: '芝麻油' },
  { id: 'natural-oils:olive-oil', slug: 'olive-oil', featured: true, vi: 'Dầu olive', zh: '橄榄油' },
  { id: 'natural-oils:avocado-oil', slug: 'avocado-oil', featured: false, vi: 'Dầu avocado', zh: '牛油果油' },
] as const;

async function main() {
  console.log('Seeding category: natural-oils');
  await db
    .insert(categories)
    .values({ id: CATEGORY.id, slug: CATEGORY.slug, sortOrder: 0, isPublished: true })
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

  console.log(`Seeding ${NATURAL_OILS_SEED.length} products...`);
  for (const [index, item] of NATURAL_OILS_SEED.entries()) {
    await db
      .insert(products)
      .values({
        id: item.id,
        slug: item.slug,
        categoryId: CATEGORY.id,
        isFeatured: item.featured,
        isPublished: true, // already live in production today
        sortOrder: index,
      })
      .onConflictDoUpdate({
        target: products.id,
        set: {
          slug: item.slug,
          categoryId: CATEGORY.id,
          isFeatured: item.featured,
          isPublished: true,
          sortOrder: index,
          updatedAt: new Date(),
        },
      });

    await db
      .insert(productTranslations)
      .values({ productId: item.id, locale: 'vi', name: item.vi })
      .onConflictDoUpdate({
        target: [productTranslations.productId, productTranslations.locale],
        set: { name: item.vi },
      });

    await db
      .insert(productTranslations)
      .values({ productId: item.id, locale: 'zh', name: item.zh })
      .onConflictDoUpdate({
        target: [productTranslations.productId, productTranslations.locale],
        set: { name: item.zh },
      });

    console.log(`  seeded ${item.slug}`);
  }

  console.log('Seed complete. No pricing, SKU, inventory, images, or content rows were created.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
