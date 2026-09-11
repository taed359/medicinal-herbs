/**
 * Extends the `wholesale` category with the 6 remaining Natural Oils that
 * didn't get a bulk sibling in `seed-wholesale-products.ts` (that script
 * covered the 9 common commodity/carrier oils; these 6 are the more
 * specialty/nut oils: avocado, grapeseed, flaxseed, hempseed, walnut,
 * macadamia). Same pattern, same provenance rules (see that file's doc
 * comment for the full (A)/(B)/(C) breakdown) — not repeated verbatim
 * here, only what differs:
 *
 *   - Botanical name / extraction method are carried over unchanged from
 *     each oil's natural-oils sibling (seed-natural-oils-content.ts).
 *   - Deliberately NO pricing row (price-on-request), same as the other
 *     9 wholesale products.
 *   - Framing leans toward premium/cosmetic-formulation B2B use (these
 *     are specialty oils, not commodity ones) rather than generic bulk
 *     value copy, but keeps the same claimType discipline (factual/
 *     marketing only, never structure_function).
 *
 * NOTE: the 4 "milk-oil" mini-size retail products (coconut-milk-oil,
 * sesame-milk-oil, olive-milk-oil, avocado-milk-oil) are deliberately NOT
 * given their own wholesale sibling here, even though they're part of
 * the 19 Natural Oils products — they're the same underlying oil as an
 * already-wholesaled product (coconut, sesame, olive, avocado), just
 * packaged smaller for retail. A separate wholesale entry for them would
 * duplicate an oil this category already sells in bulk. Wholesale now
 * covers all 15 distinct oil SUBSTANCES across the 19 retail products
 * (9 here + 6 in this file), which is the coherent reading of "cover
 * every oil in bulk."
 *
 * Depends on the `wholesale` category row already existing — run
 * `npm run db:seed:wholesale-category` first if not already done on this
 * target. Safe to re-run (ON CONFLICT DO UPDATE / deterministic ids).
 */
import { db } from '../db/client';
import {
  productBenefits,
  productTranslations,
  productVariantTranslations,
  productVariants,
  productWarnings,
  products,
} from '../../db/schema';

type ClaimType = 'factual' | 'marketing';
interface LocaleContent {
  name: string;
  shortDescription: string;
  description: string;
  ingredients: string;
  usage: string;
  benefits: { text: string; claimType: ClaimType }[];
  warnings: string[];
}
interface WholesaleProductSeed {
  slug: string;
  botanicalName: string;
  extractionMethod: 'cold-pressed' | 'expeller-pressed' | 'refined' | 'virgin-unrefined';
  sku: string;
  vi: LocaleContent;
  zh: LocaleContent;
}

const CATEGORY_ID = 'wholesale';
const COUNTRY = 'VN';
const MANUFACTURER = 'ABC Company';
const CONTAINER_TYPE = 'plastic-drum';
const DRUM_LITERS = '20';

const BASE_WARNINGS_VI = [
  'Sản phẩm dùng trong sản xuất, pha chế hoặc phân phối lại — cơ sở sử dụng nên tuân thủ quy định an toàn hiện hành khi xử lý số lượng lớn.',
  'Bảo quản nơi khô mát, tránh ánh nắng trực tiếp.',
];
const BASE_WARNINGS_ZH = [
  '本品用于生产、调配或分销——大宗处理时请遵循现行安全规定。',
  '请存放于阴凉干燥处，避免阳光直射。',
];
const TREE_NUT_ALLERGY_VI = 'Chiết xuất từ hạt cây — cơ sở sản xuất/pha chế cho khách hàng cuối nên cân nhắc ghi rõ thành phần gây dị ứng trên bao bì sản phẩm cuối.';
const TREE_NUT_ALLERGY_ZH = '本品萃取自坚果——用于终端产品生产时，建议在最终包装上清楚标示过敏原信息。';
const OXIDATION_NOTE_VI = 'Dễ oxy hóa hơn một số loại dầu khác — nên xoay vòng tồn kho hợp lý và bảo quản đúng cách để giữ chất lượng.';
const OXIDATION_NOTE_ZH = '相较其他油品更易氧化——建议合理周转库存并妥善保存以维持品质。';

const BULK_BENEFIT_VI: { text: string; claimType: ClaimType } = {
  text: 'Đóng thùng 20 lít, tối ưu chi phí cho đơn hàng số lượng lớn',
  claimType: 'marketing',
};
const BULK_BENEFIT_ZH: { text: string; claimType: ClaimType } = {
  text: '20升整桶装，为大宗订单优化成本',
  claimType: 'marketing',
};
const CONSISTENCY_BENEFIT_VI: { text: string; claimType: ClaimType } = {
  text: 'Chất lượng đồng nhất giữa các lô hàng, phù hợp sản xuất mỹ phẩm cao cấp',
  claimType: 'marketing',
};
const CONSISTENCY_BENEFIT_ZH: { text: string; claimType: ClaimType } = {
  text: '批次品质稳定一致，适合高端化妆品生产使用',
  claimType: 'marketing',
};

const PRODUCTS: WholesaleProductSeed[] = [
  {
    slug: 'avocado-oil-bulk',
    botanicalName: 'Persea Gratissima (Avocado) Oil',
    extractionMethod: 'cold-pressed',
    sku: 'AV-20L',
    vi: {
      name: 'Dầu bơ / avocado (thùng 20L)',
      shortDescription: 'Dầu bơ ép lạnh, đóng thùng 20 lít — kết cấu giàu dưỡng chất, dành cho cơ sở sản xuất mỹ phẩm cao cấp.',
      description: 'Cùng loại dầu bơ ép lạnh như dòng bán lẻ, giàu vitamin E và axit oleic, đóng trong thùng nhựa 20 lít phù hợp cho cơ sở sản xuất mỹ phẩm dưỡng ẩm chuyên sâu hoặc đơn vị phân phối lại. Giá bán theo báo giá, tùy số lượng đặt hàng.',
      ingredients: 'Thành phần: Dầu bơ ép lạnh (tên gọi quốc tế theo quy ước INCI: Persea Gratissima Oil).',
      usage: 'Dùng làm nguyên liệu trong sản xuất mỹ phẩm dưỡng ẩm chuyên sâu, hoặc phân phối lại theo nhu cầu kinh doanh.',
      benefits: [BULK_BENEFIT_VI, CONSISTENCY_BENEFIT_VI, { text: 'Giàu vitamin E và axit oleic tự nhiên', claimType: 'factual' }],
      warnings: [...BASE_WARNINGS_VI],
    },
    zh: {
      name: '牛油果油（20L桶装）',
      shortDescription: '冷压牛油果油，20升整桶装——质地丰润，为高端化妆品生产商提供。',
      description: '与零售系列成分相同的冷压牛油果油，天然富含维生素E与油酸，装于20升塑料桶中，适合生产深层滋润类化妆品的厂商或经销商采购。价格按报价提供，依订购数量而定。',
      ingredients: '成分：冷压牛油果油（国际化妆品成分命名 INCI：Persea Gratissima Oil）。',
      usage: '可用作深层滋润类化妆品生产原料，或依业务需求转售分销。',
      benefits: [BULK_BENEFIT_ZH, CONSISTENCY_BENEFIT_ZH, { text: '天然富含维生素E与油酸', claimType: 'factual' }],
      warnings: [...BASE_WARNINGS_ZH],
    },
  },
  {
    slug: 'grapeseed-oil-bulk',
    botanicalName: 'Vitis Vinifera (Grape) Seed Oil',
    extractionMethod: 'expeller-pressed',
    sku: 'GS-20L',
    vi: {
      name: 'Dầu hạt nho (thùng 20L)',
      shortDescription: 'Dầu hạt nho, đóng thùng 20 lít — kết cấu rất nhẹ, dành cho cơ sở sản xuất mỹ phẩm.',
      description: 'Cùng loại dầu hạt nho như dòng bán lẻ, giàu axit linoleic và polyphenol chống oxy hóa, đóng trong thùng nhựa 20 lít phù hợp cho cơ sở sản xuất mỹ phẩm dành cho da dầu/da hỗn hợp hoặc đơn vị phân phối lại. Giá bán theo báo giá, tùy số lượng đặt hàng.',
      ingredients: 'Thành phần: Dầu hạt nho ép cơ học (tên gọi quốc tế theo quy ước INCI: Vitis Vinifera Seed Oil).',
      usage: 'Dùng làm nguyên liệu trong sản xuất mỹ phẩm, hoặc phân phối lại theo nhu cầu kinh doanh.',
      benefits: [BULK_BENEFIT_VI, CONSISTENCY_BENEFIT_VI, { text: 'Kết cấu rất nhẹ, ít gây bít lỗ chân lông', claimType: 'factual' }],
      warnings: [...BASE_WARNINGS_VI],
    },
    zh: {
      name: '葡萄籽油（20L桶装）',
      shortDescription: '葡萄籽油，20升整桶装——质地极为轻盈，为化妆品生产商提供。',
      description: '与零售系列成分相同的葡萄籽油，富含亚油酸与多酚类抗氧化成分，装于20升塑料桶中，适合生产油性/混合性肌肤类化妆品的厂商或经销商采购。价格按报价提供，依订购数量而定。',
      ingredients: '成分：机榨葡萄籽油（国际化妆品成分命名 INCI：Vitis Vinifera Seed Oil）。',
      usage: '可用作化妆品生产原料，或依业务需求转售分销。',
      benefits: [BULK_BENEFIT_ZH, CONSISTENCY_BENEFIT_ZH, { text: '质地极为轻盈，致痘性低', claimType: 'factual' }],
      warnings: [...BASE_WARNINGS_ZH],
    },
  },
  {
    slug: 'flaxseed-oil-bulk',
    botanicalName: 'Linum Usitatissimum (Linseed) Seed Oil',
    extractionMethod: 'cold-pressed',
    sku: 'FS-20L',
    vi: {
      name: 'Dầu hạt lanh (thùng 20L)',
      shortDescription: 'Dầu hạt lanh ép lạnh, đóng thùng 20 lít — giàu omega-3, dành cho cơ sở sản xuất mỹ phẩm.',
      description: 'Cùng loại dầu hạt lanh ép lạnh như dòng bán lẻ, giàu axit alpha-linolenic (omega-3 thực vật), đóng trong thùng nhựa 20 lít phù hợp cho cơ sở sản xuất mỹ phẩm hoặc đơn vị phân phối lại. Giá bán theo báo giá, tùy số lượng đặt hàng.',
      ingredients: 'Thành phần: Dầu hạt lanh ép lạnh (tên gọi quốc tế theo quy ước INCI: Linum Usitatissimum Seed Oil).',
      usage: 'Dùng làm nguyên liệu trong sản xuất mỹ phẩm, hoặc phân phối lại theo nhu cầu kinh doanh.',
      benefits: [BULK_BENEFIT_VI, CONSISTENCY_BENEFIT_VI, { text: 'Giàu axit béo omega-3 (ALA) từ thực vật', claimType: 'factual' }],
      warnings: [...BASE_WARNINGS_VI, OXIDATION_NOTE_VI],
    },
    zh: {
      name: '亚麻籽油（20L桶装）',
      shortDescription: '冷压亚麻籽油，20升整桶装——富含omega-3，为化妆品生产商提供。',
      description: '与零售系列成分相同的冷压亚麻籽油，天然富含α-亚麻酸（植物来源omega-3），装于20升塑料桶中，适合生产商或经销商采购。价格按报价提供，依订购数量而定。',
      ingredients: '成分：冷压亚麻籽油（国际化妆品成分命名 INCI：Linum Usitatissimum Seed Oil）。',
      usage: '可用作化妆品生产原料，或依业务需求转售分销。',
      benefits: [BULK_BENEFIT_ZH, CONSISTENCY_BENEFIT_ZH, { text: '富含植物来源的omega-3脂肪酸（ALA）', claimType: 'factual' }],
      warnings: [...BASE_WARNINGS_ZH, OXIDATION_NOTE_ZH],
    },
  },
  {
    slug: 'hempseed-oil-bulk',
    botanicalName: 'Cannabis Sativa Seed Oil',
    extractionMethod: 'cold-pressed',
    sku: 'HS-20L',
    vi: {
      name: 'Dầu hạt gai dầu (thùng 20L)',
      shortDescription: 'Dầu hạt gai dầu ép lạnh, đóng thùng 20 lít — không chứa THC/CBD, dành cho cơ sở sản xuất mỹ phẩm.',
      description: 'Cùng loại dầu hạt gai dầu ép lạnh như dòng bán lẻ — khác biệt với chiết xuất CBD, hoàn toàn không chứa THC hay CBD — tỷ lệ omega-3/omega-6 cân bằng, đóng trong thùng nhựa 20 lít phù hợp cho cơ sở sản xuất mỹ phẩm hoặc đơn vị phân phối lại. Giá bán theo báo giá, tùy số lượng đặt hàng.',
      ingredients: 'Thành phần: Dầu hạt gai dầu ép lạnh (tên gọi quốc tế theo quy ước INCI: Cannabis Sativa Seed Oil).',
      usage: 'Dùng làm nguyên liệu trong sản xuất mỹ phẩm, hoặc phân phối lại theo nhu cầu kinh doanh.',
      benefits: [BULK_BENEFIT_VI, CONSISTENCY_BENEFIT_VI, { text: 'Tỷ lệ omega-3/omega-6 cân bằng tự nhiên', claimType: 'factual' }],
      warnings: [...BASE_WARNINGS_VI],
    },
    zh: {
      name: '大麻籽油（20L桶装）',
      shortDescription: '冷压大麻籽油，20升整桶装——不含THC或CBD，为化妆品生产商提供。',
      description: '与零售系列成分相同的冷压大麻籽油——与CBD萃取物不同，籽油本身完全不含THC或CBD——omega-3与omega-6比例天然均衡，装于20升塑料桶中，适合生产商或经销商采购。价格按报价提供，依订购数量而定。',
      ingredients: '成分：冷压大麻籽油（国际化妆品成分命名 INCI：Cannabis Sativa Seed Oil）。',
      usage: '可用作化妆品生产原料，或依业务需求转售分销。',
      benefits: [BULK_BENEFIT_ZH, CONSISTENCY_BENEFIT_ZH, { text: '天然均衡的omega-3与omega-6比例', claimType: 'factual' }],
      warnings: [...BASE_WARNINGS_ZH],
    },
  },
  {
    slug: 'walnut-oil-bulk',
    botanicalName: 'Juglans Regia (Walnut) Seed Oil',
    extractionMethod: 'cold-pressed',
    sku: 'WN-20L',
    vi: {
      name: 'Dầu óc chó (thùng 20L)',
      shortDescription: 'Dầu óc chó ép lạnh, đóng thùng 20 lít — giàu omega-3 và vitamin E, dành cho cơ sở sản xuất mỹ phẩm.',
      description: 'Cùng loại dầu óc chó ép lạnh như dòng bán lẻ, giàu axit béo omega-3 và vitamin E tự nhiên, đóng trong thùng nhựa 20 lít phù hợp cho cơ sở sản xuất mỹ phẩm hoặc đơn vị phân phối lại. Giá bán theo báo giá, tùy số lượng đặt hàng.',
      ingredients: 'Thành phần: Dầu óc chó ép lạnh (tên gọi quốc tế theo quy ước INCI: Juglans Regia Seed Oil).',
      usage: 'Dùng làm nguyên liệu trong sản xuất mỹ phẩm chăm sóc da/tóc, hoặc phân phối lại theo nhu cầu kinh doanh.',
      benefits: [BULK_BENEFIT_VI, CONSISTENCY_BENEFIT_VI, { text: 'Giàu axit béo omega-3 và vitamin E tự nhiên', claimType: 'factual' }],
      warnings: [...BASE_WARNINGS_VI, TREE_NUT_ALLERGY_VI],
    },
    zh: {
      name: '核桃油（20L桶装）',
      shortDescription: '冷压核桃油，20升整桶装——富含omega-3与维生素E，为化妆品生产商提供。',
      description: '与零售系列成分相同的冷压核桃油，天然富含omega-3脂肪酸与维生素E，装于20升塑料桶中，适合生产护肤护发类化妆品的厂商或经销商采购。价格按报价提供，依订购数量而定。',
      ingredients: '成分：冷压核桃油（国际化妆品成分命名 INCI：Juglans Regia Seed Oil）。',
      usage: '可用作护肤护发类化妆品生产原料，或依业务需求转售分销。',
      benefits: [BULK_BENEFIT_ZH, CONSISTENCY_BENEFIT_ZH, { text: '天然富含omega-3脂肪酸与维生素E', claimType: 'factual' }],
      warnings: [...BASE_WARNINGS_ZH, TREE_NUT_ALLERGY_ZH],
    },
  },
  {
    slug: 'macadamia-oil-bulk',
    botanicalName: 'Macadamia Ternifolia Seed Oil',
    extractionMethod: 'expeller-pressed',
    sku: 'MC-20L',
    vi: {
      name: 'Dầu hạt mắc ca (thùng 20L)',
      shortDescription: 'Dầu hạt mắc ca, đóng thùng 20 lít — giàu axit palmitoleic, dành cho cơ sở sản xuất mỹ phẩm cao cấp.',
      description: 'Cùng loại dầu hạt mắc ca như dòng bán lẻ, nổi bật với hàm lượng axit palmitoleic cao — gần giống cấu trúc dầu tự nhiên trên da người — đóng trong thùng nhựa 20 lít phù hợp cho cơ sở sản xuất mỹ phẩm cao cấp hoặc đơn vị phân phối lại. Giá bán theo báo giá, tùy số lượng đặt hàng.',
      ingredients: 'Thành phần: Dầu hạt mắc ca (tên gọi quốc tế theo quy ước INCI: Macadamia Ternifolia Seed Oil).',
      usage: 'Dùng làm nguyên liệu trong sản xuất mỹ phẩm cao cấp, hoặc phân phối lại theo nhu cầu kinh doanh.',
      benefits: [BULK_BENEFIT_VI, CONSISTENCY_BENEFIT_VI, { text: 'Giàu axit palmitoleic, cấu trúc gần giống dầu tự nhiên trên da', claimType: 'factual' }],
      warnings: [...BASE_WARNINGS_VI, TREE_NUT_ALLERGY_VI],
    },
    zh: {
      name: '夏威夷果油（20L桶装）',
      shortDescription: '夏威夷果油，20升整桶装——富含棕榈油酸，为高端化妆品生产商提供。',
      description: '与零售系列成分相同的夏威夷果油，以高含量棕榈油酸著称——结构与人体肌肤天然皮脂相近，装于20升塑料桶中，适合高端化妆品生产商或经销商采购。价格按报价提供，依订购数量而定。',
      ingredients: '成分：夏威夷果油（国际化妆品成分命名 INCI：Macadamia Ternifolia Seed Oil）。',
      usage: '可用作高端化妆品生产原料，或依业务需求转售分销。',
      benefits: [BULK_BENEFIT_ZH, CONSISTENCY_BENEFIT_ZH, { text: '富含棕榈油酸，结构与肌肤天然皮脂相近', claimType: 'factual' }],
      warnings: [...BASE_WARNINGS_ZH, TREE_NUT_ALLERGY_ZH],
    },
  },
];

async function main() {
  console.log(`Seeding ${PRODUCTS.length} more wholesale (bulk 20L) specialty products into the '${CATEGORY_ID}' category...`);

  for (const [index, p] of PRODUCTS.entries()) {
    const productId = `${CATEGORY_ID}:${p.slug}`;
    const variantId = `${productId}:20l`;
    console.log(`\n${productId}`);

    await db
      .insert(products)
      .values({
        id: productId,
        slug: p.slug,
        categoryId: CATEGORY_ID,
        isFeatured: false,
        isPublished: true,
        sortOrder: 9 + index, // continues after the 9 commodity wholesale products
        botanicalName: p.botanicalName,
        countryOfOriginCode: COUNTRY,
        extractionMethod: p.extractionMethod,
        manufacturerName: MANUFACTURER,
      })
      .onConflictDoUpdate({
        target: products.id,
        set: {
          slug: p.slug,
          categoryId: CATEGORY_ID,
          isPublished: true,
          sortOrder: 9 + index,
          botanicalName: p.botanicalName,
          countryOfOriginCode: COUNTRY,
          extractionMethod: p.extractionMethod,
          manufacturerName: MANUFACTURER,
          updatedAt: new Date(),
        },
      });

    await db
      .insert(productVariants)
      .values({
        id: variantId,
        productId,
        sku: p.sku,
        isDefault: true,
        sortOrder: 0,
        netQuantityValue: DRUM_LITERS,
        netQuantityUnit: 'l',
        containerType: CONTAINER_TYPE,
      })
      .onConflictDoUpdate({
        target: productVariants.id,
        set: {
          sku: p.sku,
          isDefault: true,
          sortOrder: 0,
          netQuantityValue: DRUM_LITERS,
          netQuantityUnit: 'l',
          containerType: CONTAINER_TYPE,
          gtin: null,
        },
      });
    // Deliberately no `pricing` insert -- same price-on-request pattern
    // as seed-wholesale-products.ts.

    for (const locale of ['vi', 'zh'] as const) {
      const c = p[locale];
      const variantLabel = locale === 'vi' ? `${DRUM_LITERS} lít` : `${DRUM_LITERS}升`;

      await db
        .insert(productTranslations)
        .values({
          productId,
          locale,
          name: c.name,
          shortDescription: c.shortDescription,
          description: c.description,
          ingredients: c.ingredients,
          usageInstructions: c.usage,
        })
        .onConflictDoUpdate({
          target: [productTranslations.productId, productTranslations.locale],
          set: {
            name: c.name,
            shortDescription: c.shortDescription,
            description: c.description,
            ingredients: c.ingredients,
            usageInstructions: c.usage,
          },
        });

      await db
        .insert(productVariantTranslations)
        .values({ variantId, locale, label: variantLabel })
        .onConflictDoUpdate({
          target: [productVariantTranslations.variantId, productVariantTranslations.locale],
          set: { label: variantLabel },
        });

      for (const [i, benefit] of c.benefits.entries()) {
        await db
          .insert(productBenefits)
          .values({
            id: `${productId}:benefit:${locale}:${i}`,
            productId,
            locale,
            sortOrder: i,
            text: benefit.text,
            claimType: benefit.claimType,
          })
          .onConflictDoUpdate({
            target: productBenefits.id,
            set: { text: benefit.text, claimType: benefit.claimType, sortOrder: i },
          });
      }

      for (const [i, warning] of c.warnings.entries()) {
        await db
          .insert(productWarnings)
          .values({ id: `${productId}:warning:${locale}:${i}`, productId, locale, sortOrder: i, text: warning })
          .onConflictDoUpdate({
            target: productWarnings.id,
            set: { text: warning, sortOrder: i },
          });
      }

      console.log(`  ${locale}: name, short_description, description, ingredients, usage, ${c.benefits.length} benefits, ${c.warnings.length} warnings`);
    }
  }

  console.log(
    `\nDone. Seeded ${PRODUCTS.length} more wholesale products (20 L drums). Wholesale now covers all 15 ` +
    `distinct oil substances from the Natural Oils catalog. No pricing rows (price-on-request).`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('Wholesale specialty products seed failed:', err);
  process.exit(1);
});
