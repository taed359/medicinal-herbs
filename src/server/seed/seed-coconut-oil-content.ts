/**
 * Populates verified business data and VI/ZH product content for Coconut Oil
 * (`natural-oils:coconut-oil`) only. Every other Natural Oil product is
 * untouched by this script.
 *
 * PROVENANCE, PER FIELD — three distinct categories, not one blanket
 * "researched" label (see coconut-oil-data-specification.md and the
 * research-summary table in the accompanying report for full citations):
 *
 *   (A) GENERIC RESEARCH-DERIVED FACTUAL CONTENT — true of coconut oil as
 *       a substance in general (melting/solidifying near skin temperature,
 *       INCI naming convention, comedogenic-rating caution), grounded in
 *       named sources: IJDVL (peer-reviewed dermatology journal),
 *       SpecialChem (INCI cosmetic-ingredient database), Cosmetic
 *       Ingredient Review (CIR) safety assessment, ChemicalBook
 *       (chemical-properties reference). Used in: `description`,
 *       `ingredients`, the "solid texture / melts on skin" sentence in
 *       `shortDescription`, the melting-point benefit line, and the
 *       comedogenic warning line.
 *
 *   (B) GENERATED MARKETING WORDING — cosmetic/sensory phrasing composed
 *       for this PDP (moisturizes, softens skin, supports hair care),
 *       consistent with (A) but not itself a citation-backed factual
 *       claim. Tagged `claimType: 'marketing'` in every `benefits` entry
 *       below, deliberately never `'structure_function'` (no authoritative
 *       source here establishes a structure/function claim, and none
 *       would be legally appropriate for a cosmetic-only product). No
 *       sentence anywhere in this file asserts disease treatment, cure,
 *       prevention, or a guaranteed result.
 *
 *   (C) PRODUCT-SPECIFIC FACTS — country, extraction method, manufacturer,
 *       one 100 ml default variant, and its VND price are explicit business
 *       input. Botanical name, certifications, GTIN, inventory, brand, and
 *       real product photography remain untouched/NULL. In particular,
 *       earlier copy in this
 *       file used "nguyên chất" / "纯" ("pure"/"virgin") in the short
 *       description — that implies a specific refinement grade, which is
 *       exactly the kind of (C) product-specific fact this script must
 *       not assert while extraction_method is still NULL. It was removed;
 *       only the generic (A) texture/melting-point sentence remains.
 *
 * Safe to re-run: every insert uses ON CONFLICT DO UPDATE / deterministic
 * ids, so re-running this script updates the same rows rather than
 * duplicating them.
 *
 * Not written here on purpose: no source URLs or research notes are
 * stored in the production database — the schema has no field for them
 * (see src/db/schema.ts). Provenance lives here, in this file's comments
 * and in coconut-oil-data-specification.md, not in the `product_*` tables.
 */
import { db } from '../db/client';
import {
  pricing,
  productBenefits,
  productTranslations,
  productVariantTranslations,
  productVariants,
  productWarnings,
  products,
} from '../../db/schema';
import { eq } from 'drizzle-orm';

const PRODUCT_ID = 'natural-oils:coconut-oil';
const VARIANT_ID = `${PRODUCT_ID}:100ml`;
const PRICE_ID = `${VARIANT_ID}:price:vnd`;

const CONTENT = {
  vi: {
    shortDescription:
      'Dầu dừa với kết cấu đặc, tan chảy nhẹ nhàng khi tiếp xúc với da — một loại dầu dưỡng ẩm tự nhiên quen thuộc trong chăm sóc da và tóc.',
    description:
      'Dầu dừa là một loại dầu thực vật được biết đến rộng rãi với đặc tính dưỡng ẩm và làm mềm da tự nhiên. Ở nhiệt độ mát, dầu dừa thường ở dạng đặc và tan chảy khi tiếp xúc với nhiệt độ ấm của da hoặc bàn tay. Đây là một lựa chọn quen thuộc cho những ai yêu thích các sản phẩm chăm sóc có nguồn gốc thực vật, có thể dùng cho da hoặc tóc như một phần của quy trình dưỡng hằng ngày.',
    ingredients: 'Thành phần: Dầu dừa (tên gọi quốc tế theo quy ước INCI: Cocos Nucifera Oil).',
    usage:
      'Thoa một lượng nhỏ lên da hoặc tóc, có thể dùng trực tiếp hoặc kết hợp trong quy trình chăm sóc hằng ngày. Nếu dầu ở dạng đặc do nhiệt độ thấp, có thể làm ấm nhẹ giữa hai lòng bàn tay trước khi sử dụng.',
    benefits: [
      { text: 'Dưỡng ẩm tự nhiên, giúp da mềm mại hơn', claimType: 'marketing' },
      { text: 'Hỗ trợ dưỡng tóc, phù hợp dùng cho tóc khô hoặc hư tổn nhẹ', claimType: 'marketing' },
      { text: 'Kết cấu đặc ở nhiệt độ mát, tan chảy khi tiếp xúc với da', claimType: 'factual' },
    ],
    warnings: [
      'Chỉ dùng ngoài da.',
      'Nên thử trên một vùng da nhỏ trước khi sử dụng rộng rãi để kiểm tra phản ứng.',
      'Có đặc tính dễ gây bít tắc lỗ chân lông (comedogenic) — cân nhắc trước khi dùng cho da mặt dễ nổi mụn.',
      'Ngưng sử dụng nếu xuất hiện dấu hiệu kích ứng, mẩn đỏ hoặc khó chịu.',
      'Người có tiền sử dị ứng với dừa nên thận trọng khi sử dụng.',
    ],
  },
  zh: {
    shortDescription: '椰子油质地浓郁，遇肌肤温度即化，是护肤护发中常见的天然滋润油。',
    description:
      '椰子油是一种广受认可的植物油，以天然滋润和柔软肌肤的特性著称。在较凉的环境下通常呈固态，接触肌肤或手部温度后会自然融化。对于偏爱植物来源护理产品的人群来说，椰子油是护肤或护发日常保养中的熟悉之选。',
    ingredients: '成分：椰子油（国际化妆品成分命名 INCI：Cocos Nucifera Oil）。',
    usage: '取适量涂抹于肌肤或头发，可直接使用，也可融入日常护理步骤。若因低温呈固态，可先在掌心轻轻搓热后再使用。',
    benefits: [
      { text: '天然滋润，有助肌肤更加柔软', claimType: 'marketing' },
      { text: '有助头发护理，适合干燥或轻微受损的发质', claimType: 'marketing' },
      { text: '低温下呈固态，接触肌肤后自然融化', claimType: 'factual' },
    ],
    warnings: [
      '仅供外用。',
      '建议先于小范围肌肤测试，确认无不良反应后再大面积使用。',
      '质地较易造成毛孔堵塞（致痘性），痘痘肌肤或易长粉刺者使用前应谨慎考虑。',
      '若出现刺激、泛红或不适，请立即停止使用。',
      '对椰子有过敏史者使用时应格外小心。',
    ],
  },
} as const;

async function main() {
  console.log(`Populating verified business data and content for ${PRODUCT_ID} (VI + ZH)...`);

  await db
    .update(products)
    .set({
      countryOfOriginCode: 'VN',
      extractionMethod: 'cold-pressed',
      manufacturerName: 'ABC Company',
    })
    .where(eq(products.id, PRODUCT_ID));

  await db
    .insert(productVariants)
    .values({
      id: VARIANT_ID,
      productId: PRODUCT_ID,
      sku: 'CO-100',
      isDefault: true,
      sortOrder: 0,
      netQuantityValue: '100',
      netQuantityUnit: 'ml',
      containerType: 'amber-glass',
    })
    .onConflictDoUpdate({
      target: productVariants.id,
      set: {
        sku: 'CO-100',
        isDefault: true,
        sortOrder: 0,
        netQuantityValue: '100',
        netQuantityUnit: 'ml',
        containerType: 'amber-glass',
        gtin: null,
      },
    });

  for (const locale of ['vi', 'zh'] as const) {
    await db
      .insert(productVariantTranslations)
      .values({ variantId: VARIANT_ID, locale, label: '100 ml' })
      .onConflictDoUpdate({
        target: [productVariantTranslations.variantId, productVariantTranslations.locale],
        set: { label: '100 ml' },
      });
  }

  await db
    .insert(pricing)
    .values({
      id: PRICE_ID,
      variantId: VARIANT_ID,
      priceMinor: 320000,
      compareAtMinor: null,
      currency: 'VND',
    })
    .onConflictDoUpdate({
      target: pricing.id,
      set: { priceMinor: 320000, compareAtMinor: null, currency: 'VND', effectiveTo: null },
    });

  for (const locale of ['vi', 'zh'] as const) {
    const c = CONTENT[locale];

    await db
      .insert(productTranslations)
      .values({
        productId: PRODUCT_ID,
        locale,
        name: locale === 'vi' ? 'Dầu dừa' : '椰子油', // unchanged — matches existing seeded name
        shortDescription: c.shortDescription,
        description: c.description,
        ingredients: c.ingredients,
        usageInstructions: c.usage,
      })
      .onConflictDoUpdate({
        target: [productTranslations.productId, productTranslations.locale],
        set: {
          shortDescription: c.shortDescription,
          description: c.description,
          ingredients: c.ingredients,
          usageInstructions: c.usage,
        },
      });

    for (const [index, benefit] of c.benefits.entries()) {
      await db
        .insert(productBenefits)
        .values({
          id: `${PRODUCT_ID}:benefit:${locale}:${index}`,
          productId: PRODUCT_ID,
          locale,
          sortOrder: index,
          text: benefit.text,
          claimType: benefit.claimType,
        })
        .onConflictDoUpdate({
          target: productBenefits.id,
          set: { text: benefit.text, claimType: benefit.claimType, sortOrder: index },
        });
    }

    for (const [index, warning] of c.warnings.entries()) {
      await db
        .insert(productWarnings)
        .values({
          id: `${PRODUCT_ID}:warning:${locale}:${index}`,
          productId: PRODUCT_ID,
          locale,
          sortOrder: index,
          text: warning,
        })
        .onConflictDoUpdate({
          target: productWarnings.id,
          set: { text: warning, sortOrder: index },
        });
    }

    console.log(`  ${locale}: short_description, description, ingredients, usage, ${c.benefits.length} benefits, ${c.warnings.length} warnings`);
  }

  console.log(
    'Done. Added verified origin, extraction method, manufacturer, one 100 ml default variant, ' +
    'and its VND price. Left untouched/NULL: botanical_name, GTIN, inventory, certifications, ' +
    'brand, and product-specific photography.'
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('Coconut Oil content seed failed:', err);
  process.exit(1);
});
