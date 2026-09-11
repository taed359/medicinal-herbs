/**
 * Seeds one `product_images` (role: 'primary') row per product, pointing
 * at the abstract, brand-owned "oil family" icon under
 * public/images/products/oils/ -- see src/lib/oil-type-icons.ts for the
 * full rationale and the product -> family mapping.
 *
 * NOT real product photography. Every icon is the same abstract bottle
 * silhouette as the existing presentation-layer placeholder
 * (src/lib/product-image-fallback.ts), with one distinguishing abstract
 * motif per oil family -- no label, no logo, no photo. This is a
 * deliberate, narrow exception to that file's "don't create fake
 * product-image rows pointing at shared placeholder bytes" rule: every
 * *different* oil gets its own distinct asset (never one image shared
 * across unrelated products), so this cannot repeat the earlier incident
 * (a competitor's real branded product photo used as a shared
 * placeholder across the whole catalog).
 *
 * Alt text is deliberately worded as an illustration ("Minh hoạ dầu
 * dừa" / "椰子油示意图"), never as if it were a real photo.
 *
 * Covers all 34 products (19 Natural Oils + 15 Wholesale). Safe to
 * re-run: ON CONFLICT DO UPDATE keyed on deterministic ids.
 */
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { productImages, productImageTranslations } from '../../db/schema';
import {
  OIL_FAMILY_LABEL,
  OIL_ICON_SIZE,
  PRODUCT_OIL_FAMILY,
  oilFamilyIconUrl,
} from '../../lib/oil-type-icons';

async function main() {
  const productIds = Object.keys(PRODUCT_OIL_FAMILY);

  for (const productId of productIds) {
    const family = PRODUCT_OIL_FAMILY[productId];
    const label = OIL_FAMILY_LABEL[family];
    const imageId = `${productId}:image:primary`;
    const url = oilFamilyIconUrl(family);

    console.log(`${productId} -> ${family}`);

    await db
      .insert(productImages)
      .values({
        id: imageId,
        productId,
        url,
        role: 'primary',
        width: OIL_ICON_SIZE,
        height: OIL_ICON_SIZE,
        sortOrder: 0,
      })
      .onConflictDoUpdate({
        target: productImages.id,
        set: { url, role: 'primary', width: OIL_ICON_SIZE, height: OIL_ICON_SIZE, sortOrder: 0 },
      });

    const altByLocale: Record<'vi' | 'zh', string> = {
      vi: `Minh hoạ ${label.vi}`,
      zh: `${label.zh}示意图`,
    };

    for (const locale of ['vi', 'zh'] as const) {
      await db
        .insert(productImageTranslations)
        .values({ imageId, locale, alt: altByLocale[locale] })
        .onConflictDoUpdate({
          target: [productImageTranslations.imageId, productImageTranslations.locale],
          set: { alt: altByLocale[locale] },
        });
    }
  }

  console.log(`\nDone. Seeded 1 primary image + vi/zh alt text for ${productIds.length} products.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Product icon seed failed:', err);
  process.exit(1);
});
