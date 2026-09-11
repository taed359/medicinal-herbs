/**
 * One-time fix for a pre-existing data-quality bug flagged during the
 * Natural Oils content seed (see seed-natural-oils-content.ts's doc
 * comment): the 4 "mini/travel-size" retail products' VI names correctly
 * say "nhỏ" (small), but their ZH names say "奶油" (milk/cream) instead
 * of matching that meaning — the two don't agree with each other. These
 * ZH names were originally seeded by seed-natural-oils.ts before this
 * script existed.
 *
 * This ONLY updates the `name` column on the 4 affected ZH
 * product_translations rows — nothing else (no description/benefits/
 * warnings/pricing touched). User explicitly asked for this fix.
 *
 * Safe to re-run (plain UPDATE, idempotent by construction).
 */
import { eq, and } from 'drizzle-orm';
import { db } from '../db/client';
import { productTranslations } from '../../db/schema';

// vi name (unchanged, for reference) -> corrected zh name
const FIXES: { productId: string; viNameForReference: string; newZhName: string }[] = [
  { productId: 'natural-oils:coconut-milk-oil', viNameForReference: 'Dầu dừa nhỏ', newZhName: '迷你椰子油' },
  { productId: 'natural-oils:sesame-milk-oil', viNameForReference: 'Dầu mè nhỏ', newZhName: '迷你芝麻油' },
  { productId: 'natural-oils:olive-milk-oil', viNameForReference: 'Dầu olive nhỏ', newZhName: '迷你橄榄油' },
  { productId: 'natural-oils:avocado-milk-oil', viNameForReference: 'Dầu avocado nhỏ', newZhName: '迷你牛油果油' },
];

async function main() {
  console.log(`Fixing ZH names on ${FIXES.length} "mini" Natural Oils products so they match their VI "nhỏ" (small) meaning...`);

  for (const fix of FIXES) {
    const result = await db
      .update(productTranslations)
      .set({ name: fix.newZhName })
      .where(and(eq(productTranslations.productId, fix.productId), eq(productTranslations.locale, 'zh')))
      .returning({ productId: productTranslations.productId });

    if (result.length === 0) {
      console.warn(`  ⚠ ${fix.productId}: no zh row found — nothing updated (product may not be seeded on this DB yet)`);
    } else {
      console.log(`  ${fix.productId}: zh name -> "${fix.newZhName}" (vi stays "${fix.viNameForReference}")`);
    }
  }

  console.log('\nDone.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Milk-oil ZH name fix failed:', err);
  process.exit(1);
});
