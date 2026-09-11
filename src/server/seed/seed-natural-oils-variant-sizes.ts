/**
 * Extends every Natural Oils retail product's single existing variant
 * (seeded by seed-natural-oils-content.ts / seed-coconut-oil-content.ts)
 * into 3 real size options, so ProductDetail.astro's variant picker
 * (which only renders when `variants.length > 1 && every variant has a
 * real price`) and its savings badge (needs a real `compareAtMinor` on
 * at least one variant) have real data to show -- neither has ever
 * fired for any product until now, since every product only ever had
 * exactly one variant with `compareAtMinor: null`.
 *
 * PROVENANCE: this is an extension of the same (C) FABRICATED BUSINESS
 * FACTS category already established and explicitly approved for this
 * catalog (SKU, size, VND price -- see seed-natural-oils-content.ts's
 * own doc comment quoting the approval). The two new sizes' prices are
 * derived arithmetically from each product's own already-approved base
 * price (small size at a per-ml premium, large size at a per-ml bulk
 * discount vs. a linear "regular rate" comparison price) -- not
 * independently invented numbers, and rounded to the same clean-number
 * scale already used throughout this catalog (nearest 5,000 VND for the
 * 100 ml family, nearest 1,000 VND for the 30 ml "mini" family).
 *
 * Deliberately excludes the 15 Wholesale products: those are
 * intentionally "price on request" (see seed-wholesale-category.ts's doc
 * comment) with no pricing row at all -- adding priced size variants
 * there would contradict that existing, deliberate design decision
 * rather than extend it.
 *
 * SKU scheme: regular-size products (100 ml base) get +50 ml / +250 ml
 * siblings; "milk-oil" mini products (30 ml base) get +15 ml / +45 ml
 * siblings. These two size sets never overlap, so e.g. coconut-oil's new
 * "CO-50" variant and coconut-milk-oil's new variants ("CO-15"/"CO-45")
 * never collide on the globally-unique `sku` column.
 *
 * Safe to re-run: ON CONFLICT DO UPDATE keyed on deterministic ids; the
 * pre-existing base variant is only updated (sortOrder), never
 * duplicated, because its id is computed with the exact same formula
 * seed-natural-oils-content.ts already used.
 */
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { pricing, productVariantTranslations, productVariants } from '../../db/schema';

interface BaseVariant {
  productId: string;
  skuPrefix: string;
  baseMl: number;
  basePriceMinor: number;
  isMini: boolean;
}

const BASE_VARIANTS: BaseVariant[] = [
  { productId: 'natural-oils:coconut-oil', skuPrefix: 'CO', baseMl: 100, basePriceMinor: 320000, isMini: false },
  { productId: 'natural-oils:rice-bran-oil', skuPrefix: 'RB', baseMl: 100, basePriceMinor: 150000, isMini: false },
  { productId: 'natural-oils:peanut-oil', skuPrefix: 'PN', baseMl: 100, basePriceMinor: 140000, isMini: false },
  { productId: 'natural-oils:sunflower-oil', skuPrefix: 'SF', baseMl: 100, basePriceMinor: 130000, isMini: false },
  { productId: 'natural-oils:soybean-oil', skuPrefix: 'SB', baseMl: 100, basePriceMinor: 120000, isMini: false },
  { productId: 'natural-oils:canola-oil', skuPrefix: 'CN', baseMl: 100, basePriceMinor: 135000, isMini: false },
  { productId: 'natural-oils:palm-oil', skuPrefix: 'PL', baseMl: 100, basePriceMinor: 110000, isMini: false },
  { productId: 'natural-oils:sesame-oil', skuPrefix: 'SE', baseMl: 100, basePriceMinor: 230000, isMini: false },
  { productId: 'natural-oils:olive-oil', skuPrefix: 'OL', baseMl: 100, basePriceMinor: 290000, isMini: false },
  { productId: 'natural-oils:avocado-oil', skuPrefix: 'AV', baseMl: 100, basePriceMinor: 340000, isMini: false },
  { productId: 'natural-oils:grapeseed-oil', skuPrefix: 'GS', baseMl: 100, basePriceMinor: 260000, isMini: false },
  { productId: 'natural-oils:flaxseed-oil', skuPrefix: 'FS', baseMl: 100, basePriceMinor: 250000, isMini: false },
  { productId: 'natural-oils:hempseed-oil', skuPrefix: 'HS', baseMl: 100, basePriceMinor: 380000, isMini: false },
  { productId: 'natural-oils:walnut-oil', skuPrefix: 'WN', baseMl: 100, basePriceMinor: 360000, isMini: false },
  { productId: 'natural-oils:macadamia-oil', skuPrefix: 'MC', baseMl: 100, basePriceMinor: 420000, isMini: false },
  { productId: 'natural-oils:coconut-milk-oil', skuPrefix: 'CO', baseMl: 30, basePriceMinor: 99000, isMini: true },
  { productId: 'natural-oils:sesame-milk-oil', skuPrefix: 'SE', baseMl: 30, basePriceMinor: 79000, isMini: true },
  { productId: 'natural-oils:olive-milk-oil', skuPrefix: 'OL', baseMl: 30, basePriceMinor: 99000, isMini: true },
  { productId: 'natural-oils:avocado-milk-oil', skuPrefix: 'AV', baseMl: 30, basePriceMinor: 119000, isMini: true },
];

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

async function main() {
  for (const base of BASE_VARIANTS) {
    const step = base.isMini ? 1000 : 5000;
    const perMl = base.basePriceMinor / base.baseMl;
    const [smallMl, largeMl] = base.isMini ? [15, 45] : [50, 250];

    // Existing base variant: only bump its sortOrder to the middle slot
    // (0 -> 1) so the 3 sizes read smallest-to-largest in the picker.
    // Same id formula as seed-natural-oils-content.ts /
    // seed-coconut-oil-content.ts, so this targets the same row.
    const baseVariantId = `${base.productId}:${base.baseMl}ml`;
    await db
      .update(productVariants)
      .set({ sortOrder: 1 })
      .where(eq(productVariants.id, baseVariantId));

    // Small size: per-ml premium (smaller sizes cost more per ml -- a
    // real, common retail pattern), no compareAtMinor.
    const smallPriceMinor = roundTo(perMl * smallMl * 1.12, step);

    // Large size: linear "regular rate" price becomes the strikethrough
    // compareAtMinor; the actual price is that same rate at a ~10% bulk
    // discount, which is what produces the savings badge.
    const largeCompareAtMinor = roundTo(perMl * largeMl, step);
    const largePriceMinor = roundTo(largeCompareAtMinor * 0.9, step);

    const sizes: {
      ml: number;
      sku: string;
      priceMinor: number;
      compareAtMinor: number | null;
      sortOrder: number;
    }[] = [
      { ml: smallMl, sku: `${base.skuPrefix}-${smallMl}`, priceMinor: smallPriceMinor, compareAtMinor: null, sortOrder: 0 },
      { ml: largeMl, sku: `${base.skuPrefix}-${largeMl}`, priceMinor: largePriceMinor, compareAtMinor: largeCompareAtMinor, sortOrder: 2 },
    ];

    console.log(`${base.productId}: base ${base.baseMl}ml kept, +${smallMl}ml (${smallPriceMinor}), +${largeMl}ml (${largePriceMinor}, was ${largeCompareAtMinor})`);

    for (const size of sizes) {
      const variantId = `${base.productId}:${size.ml}ml`;
      const priceId = `${variantId}:price:vnd`;

      await db
        .insert(productVariants)
        .values({
          id: variantId,
          productId: base.productId,
          sku: size.sku,
          isDefault: false,
          sortOrder: size.sortOrder,
          netQuantityValue: String(size.ml),
          netQuantityUnit: 'ml',
          containerType: 'amber-glass',
        })
        .onConflictDoUpdate({
          target: productVariants.id,
          set: {
            sku: size.sku,
            isDefault: false,
            sortOrder: size.sortOrder,
            netQuantityValue: String(size.ml),
            netQuantityUnit: 'ml',
            containerType: 'amber-glass',
          },
        });

      for (const locale of ['vi', 'zh'] as const) {
        await db
          .insert(productVariantTranslations)
          .values({ variantId, locale, label: `${size.ml} ml` })
          .onConflictDoUpdate({
            target: [productVariantTranslations.variantId, productVariantTranslations.locale],
            set: { label: `${size.ml} ml` },
          });
      }

      await db
        .insert(pricing)
        .values({ id: priceId, variantId, priceMinor: size.priceMinor, compareAtMinor: size.compareAtMinor, currency: 'VND' })
        .onConflictDoUpdate({
          target: pricing.id,
          set: { priceMinor: size.priceMinor, compareAtMinor: size.compareAtMinor, currency: 'VND', effectiveTo: null },
        });
    }
  }

  console.log(`\nDone. Added 2 extra size variants (+ pricing, with a savings badge on the largest size) for ${BASE_VARIANTS.length} Natural Oils products.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Natural Oils variant-size seed failed:', err);
  process.exit(1);
});
