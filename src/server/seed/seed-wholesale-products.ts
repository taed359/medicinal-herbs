/**
 * Populates the empty `wholesale` category with 9 real, researched B2B
 * bulk products — the same well-known oils already sold retail in
 * `natural-oils` (see seed-natural-oils-content.ts), repackaged as 20 L
 * drums for business buyers (cosmetics manufacturers, spas, distributors).
 * `seed-wholesale-category.ts` only ever created the CATEGORY row and
 * explicitly deferred any products ("Deliberately does NOT create any
 * products..." — see that file's own doc comment); this is the first
 * script to actually populate it.
 *
 * Unlike seed-natural-oils-content.ts (which only UPDATEs existing rows),
 * these product rows don't exist yet, so this script INSERTs the full
 * product (id/slug/category/name/description/...) in one pass — closer to
 * seed-natural-oils.ts + seed-coconut-oil-content.ts combined into one
 * script, for one category, in one go.
 *
 * PROVENANCE, PER FIELD — same three-category split used throughout this
 * project's seed scripts:
 *
 *   (A) GENERIC RESEARCH-DERIVED FACTUAL CONTENT — botanical name and
 *       extraction method are carried over unchanged from each oil's
 *       already-seeded natural-oils sibling (same substance, same real
 *       facts, just different packaging) — see
 *       seed-natural-oils-content.ts for original sourcing.
 *
 *   (B) GENERATED MARKETING WORDING — bulk-packaging value copy ("tiết
 *       kiệm chi phí cho đơn hàng lớn", "chất lượng đồng nhất giữa các
 *       lô hàng"), tagged `claimType: 'marketing'`, never
 *       `'structure_function'`.
 *
 *   (C) FABRICATED BUSINESS FACTS — SKU, drum size, manufacturer name,
 *       and country of origin are placeholders (same 'ABC Company' / 'VN'
 *       already used throughout the catalog), NOT real supplier data.
 *       Deliberately NO pricing row is inserted for any of these 9
 *       products — this is the established "price on request" pattern
 *       (see seed-wholesale-category.ts's doc comment and
 *       ProductDetail.astro's price-on-request branch): a real variant/
 *       SKU exists, but with no active price row, so the PDP shows
 *       `t.product.priceOnRequest` ("Liên hệ" / "价格面议") instead of a
 *       fabricated bulk price nobody quoted.
 *
 * Product names include a pack-size cue ("(thùng 20L)" / "（20L桶装）") so
 * they read clearly in search results and anywhere shown without the
 * category breadcrumb for context — the retail sibling of the same oil
 * has an identical plain name otherwise.
 *
 * `extractionMethod` stays restricted to the 4 keys
 * `formatExtractionMethod` (src/lib/product-metadata-labels.ts) knows how
 * to translate. Safe to re-run: every insert uses ON CONFLICT DO UPDATE /
 * deterministic ids.
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
const PEANUT_ALLERGY_VI = 'Chiết xuất từ đậu phộng — cơ sở sản xuất/pha chế cho khách hàng cuối nên cân nhắc ghi rõ thành phần gây dị ứng trên bao bì sản phẩm cuối.';
const PEANUT_ALLERGY_ZH = '本品萃取自花生——用于终端产品生产时，建议在最终包装上清楚标示过敏原信息。';
const SOY_ALLERGY_VI = 'Chiết xuất từ đậu nành — cơ sở sản xuất/pha chế cho khách hàng cuối nên cân nhắc ghi rõ thành phần gây dị ứng trên bao bì sản phẩm cuối.';
const SOY_ALLERGY_ZH = '本品萃取自大豆——用于终端产品生产时，建议在最终包装上清楚标示过敏原信息。';

const BULK_BENEFIT_VI: { text: string; claimType: ClaimType } = {
  text: 'Đóng thùng 20 lít, tối ưu chi phí cho đơn hàng số lượng lớn',
  claimType: 'marketing',
};
const BULK_BENEFIT_ZH: { text: string; claimType: ClaimType } = {
  text: '20升整桶装，为大宗订单优化成本',
  claimType: 'marketing',
};
const CONSISTENCY_BENEFIT_VI: { text: string; claimType: ClaimType } = {
  text: 'Chất lượng đồng nhất giữa các lô hàng, phù hợp sản xuất quy mô lớn',
  claimType: 'marketing',
};
const CONSISTENCY_BENEFIT_ZH: { text: string; claimType: ClaimType } = {
  text: '批次品质稳定一致，适合规模化生产使用',
  claimType: 'marketing',
};

const PRODUCTS: WholesaleProductSeed[] = [
  {
    slug: 'coconut-oil-bulk',
    botanicalName: 'Cocos Nucifera (Coconut) Oil',
    extractionMethod: 'cold-pressed',
    sku: 'CO-20L',
    vi: {
      name: 'Dầu dừa (thùng 20L)',
      shortDescription: 'Dầu dừa ép lạnh, đóng thùng 20 lít — cùng chất lượng với dòng bán lẻ, dành cho khách hàng doanh nghiệp mua số lượng lớn.',
      description: 'Cùng loại dầu dừa ép lạnh với kết cấu đặc, tan chảy nhẹ khi tiếp xúc với da như dòng bán lẻ, được đóng trong thùng nhựa 20 lít phù hợp cho cơ sở sản xuất mỹ phẩm, spa, hoặc đơn vị phân phối lại. Giá bán theo báo giá, tùy số lượng đặt hàng — vui lòng liên hệ để được tư vấn.',
      ingredients: 'Thành phần: Dầu dừa (tên gọi quốc tế theo quy ước INCI: Cocos Nucifera Oil).',
      usage: 'Dùng làm nguyên liệu trong sản xuất mỹ phẩm, pha chế sản phẩm chăm sóc da/tóc, hoặc phân phối lại theo nhu cầu kinh doanh.',
      benefits: [BULK_BENEFIT_VI, CONSISTENCY_BENEFIT_VI, { text: 'Kết cấu đặc ở nhiệt độ mát, tan chảy khi tiếp xúc với da', claimType: 'factual' }],
      warnings: [...BASE_WARNINGS_VI],
    },
    zh: {
      name: '椰子油（20L桶装）',
      shortDescription: '冷压椰子油，20升整桶装——与零售系列同等品质，专为大宗采购的企业客户提供。',
      description: '与零售系列成分相同的冷压椰子油，质地浓郁、遇肌肤温度即化，装于20升塑料桶中，适合化妆品生产商、水疗中心或经销商采购。价格按报价提供，依订购数量而定——欢迎联系咨询。',
      ingredients: '成分：椰子油（国际化妆品成分命名 INCI：Cocos Nucifera Oil）。',
      usage: '可用作化妆品生产原料、护肤护发产品调配，或依业务需求转售分销。',
      benefits: [BULK_BENEFIT_ZH, CONSISTENCY_BENEFIT_ZH, { text: '低温下呈固态，接触肌肤后自然融化', claimType: 'factual' }],
      warnings: [...BASE_WARNINGS_ZH],
    },
  },
  {
    slug: 'sunflower-oil-bulk',
    botanicalName: 'Helianthus Annuus (Sunflower) Seed Oil',
    extractionMethod: 'cold-pressed',
    sku: 'SF-20L',
    vi: {
      name: 'Dầu hướng dương (thùng 20L)',
      shortDescription: 'Dầu hướng dương ép lạnh, đóng thùng 20 lít — kết cấu nhẹ, giàu vitamin E, dành cho khách hàng doanh nghiệp.',
      description: 'Cùng loại dầu hướng dương ép lạnh giàu vitamin E và axit linoleic như dòng bán lẻ, đóng trong thùng nhựa 20 lít phù hợp cho cơ sở sản xuất mỹ phẩm hoặc đơn vị phân phối lại. Giá bán theo báo giá, tùy số lượng đặt hàng.',
      ingredients: 'Thành phần: Dầu hướng dương ép lạnh (tên gọi quốc tế theo quy ước INCI: Helianthus Annuus Seed Oil).',
      usage: 'Dùng làm nguyên liệu trong sản xuất mỹ phẩm, pha chế sản phẩm chăm sóc da, hoặc phân phối lại theo nhu cầu kinh doanh.',
      benefits: [BULK_BENEFIT_VI, CONSISTENCY_BENEFIT_VI, { text: 'Kết cấu nhẹ, ít gây bít lỗ chân lông, giàu vitamin E', claimType: 'factual' }],
      warnings: [...BASE_WARNINGS_VI],
    },
    zh: {
      name: '葵花籽油（20L桶装）',
      shortDescription: '冷压葵花籽油，20升整桶装——质地轻盈、富含维生素E，为企业客户提供。',
      description: '与零售系列成分相同的冷压葵花籽油，天然富含维生素E与亚油酸，装于20升塑料桶中，适合化妆品生产商或经销商采购。价格按报价提供，依订购数量而定。',
      ingredients: '成分：冷压葵花籽油（国际化妆品成分命名 INCI：Helianthus Annuus Seed Oil）。',
      usage: '可用作化妆品生产原料、护肤产品调配，或依业务需求转售分销。',
      benefits: [BULK_BENEFIT_ZH, CONSISTENCY_BENEFIT_ZH, { text: '质地轻盈、致痘性低，天然富含维生素E', claimType: 'factual' }],
      warnings: [...BASE_WARNINGS_ZH],
    },
  },
  {
    slug: 'soybean-oil-bulk',
    botanicalName: 'Glycine Soja (Soybean) Oil',
    extractionMethod: 'refined',
    sku: 'SB-20L',
    vi: {
      name: 'Dầu đậu nành (thùng 20L)',
      shortDescription: 'Dầu đậu nành tinh luyện, đóng thùng 20 lít — dầu nền phổ biến, dành cho khách hàng doanh nghiệp.',
      description: 'Cùng loại dầu đậu nành tinh luyện như dòng bán lẻ, thường dùng làm dầu nền (carrier oil) trong công thức chăm sóc da, đóng trong thùng nhựa 20 lít phù hợp cho cơ sở sản xuất hoặc đơn vị phân phối lại. Giá bán theo báo giá, tùy số lượng đặt hàng.',
      ingredients: 'Thành phần: Dầu đậu nành tinh luyện (tên gọi quốc tế theo quy ước INCI: Glycine Soja Oil).',
      usage: 'Dùng làm nguyên liệu nền trong sản xuất mỹ phẩm, pha chế sản phẩm chăm sóc da, hoặc phân phối lại theo nhu cầu kinh doanh.',
      benefits: [BULK_BENEFIT_VI, CONSISTENCY_BENEFIT_VI, { text: 'Kết cấu nhẹ, thường dùng làm dầu nền', claimType: 'marketing' }],
      warnings: [...BASE_WARNINGS_VI, SOY_ALLERGY_VI],
    },
    zh: {
      name: '大豆油（20L桶装）',
      shortDescription: '精炼大豆油，20升整桶装——常见的护肤基础油，为企业客户提供。',
      description: '与零售系列成分相同的精炼大豆油，常作为护肤配方中的基础油（carrier oil），装于20升塑料桶中，适合生产商或经销商采购。价格按报价提供，依订购数量而定。',
      ingredients: '成分：精炼大豆油（国际化妆品成分命名 INCI：Glycine Soja Oil）。',
      usage: '可用作化妆品生产基础原料、护肤产品调配，或依业务需求转售分销。',
      benefits: [BULK_BENEFIT_ZH, CONSISTENCY_BENEFIT_ZH, { text: '质地轻盈，常用作护肤基础油', claimType: 'marketing' }],
      warnings: [...BASE_WARNINGS_ZH, SOY_ALLERGY_ZH],
    },
  },
  {
    slug: 'canola-oil-bulk',
    botanicalName: 'Brassica Napus (Canola) Seed Oil',
    extractionMethod: 'expeller-pressed',
    sku: 'CN-20L',
    vi: {
      name: 'Dầu cải (thùng 20L)',
      shortDescription: 'Dầu cải ép cơ học, đóng thùng 20 lít — kết cấu nhẹ, trung tính, dành cho khách hàng doanh nghiệp.',
      description: 'Cùng loại dầu cải (canola) ép cơ học như dòng bán lẻ, kết cấu nhẹ và mùi trung tính, đóng trong thùng nhựa 20 lít phù hợp cho cơ sở sản xuất hoặc đơn vị phân phối lại. Giá bán theo báo giá, tùy số lượng đặt hàng.',
      ingredients: 'Thành phần: Dầu cải ép cơ học (tên gọi quốc tế theo quy ước INCI: Brassica Napus Seed Oil).',
      usage: 'Dùng làm nguyên liệu nền trong sản xuất mỹ phẩm, pha chế sản phẩm chăm sóc da, hoặc phân phối lại theo nhu cầu kinh doanh.',
      benefits: [BULK_BENEFIT_VI, CONSISTENCY_BENEFIT_VI, { text: 'Kết cấu nhẹ, mùi trung tính, dễ kết hợp trong công thức', claimType: 'marketing' }],
      warnings: [...BASE_WARNINGS_VI],
    },
    zh: {
      name: '菜籽油（20L桶装）',
      shortDescription: '机榨菜籽油，20升整桶装——质地轻盈、气味温和，为企业客户提供。',
      description: '与零售系列成分相同的机榨菜籽油，质地轻盈、气味温和不刺鼻，装于20升塑料桶中，适合生产商或经销商采购。价格按报价提供，依订购数量而定。',
      ingredients: '成分：机榨菜籽油（国际化妆品成分命名 INCI：Brassica Napus Seed Oil）。',
      usage: '可用作化妆品生产基础原料、护肤产品调配，或依业务需求转售分销。',
      benefits: [BULK_BENEFIT_ZH, CONSISTENCY_BENEFIT_ZH, { text: '质地轻盈，气味温和，易于配方调和', claimType: 'marketing' }],
      warnings: [...BASE_WARNINGS_ZH],
    },
  },
  {
    slug: 'palm-oil-bulk',
    botanicalName: 'Elaeis Guineensis (Palm) Oil',
    extractionMethod: 'refined',
    sku: 'PL-20L',
    vi: {
      name: 'Dầu cọ (thùng 20L)',
      shortDescription: 'Dầu cọ tinh luyện, đóng thùng 20 lít — nguyên liệu nền phổ biến trong xà phòng và mỹ phẩm, dành cho khách hàng doanh nghiệp.',
      description: 'Cùng loại dầu cọ tinh luyện như dòng bán lẻ, kết cấu đặc và giàu vitamin E, đóng trong thùng nhựa 20 lít phù hợp cho cơ sở sản xuất xà phòng, mỹ phẩm hoặc đơn vị phân phối lại. Giá bán theo báo giá, tùy số lượng đặt hàng.',
      ingredients: 'Thành phần: Dầu cọ tinh luyện (tên gọi quốc tế theo quy ước INCI: Elaeis Guineensis Oil).',
      usage: 'Dùng làm nguyên liệu trong sản xuất xà phòng, mỹ phẩm, hoặc phân phối lại theo nhu cầu kinh doanh.',
      benefits: [BULK_BENEFIT_VI, CONSISTENCY_BENEFIT_VI, { text: 'Kết cấu đặc, giàu vitamin E và axit béo tự nhiên', claimType: 'factual' }],
      warnings: [...BASE_WARNINGS_VI],
    },
    zh: {
      name: '棕榈油（20L桶装）',
      shortDescription: '精炼棕榈油，20升整桶装——皂类及化妆品常用基础原料，为企业客户提供。',
      description: '与零售系列成分相同的精炼棕榈油，质地浓稠、天然富含维生素E，装于20升塑料桶中，适合皂类、化妆品生产商或经销商采购。价格按报价提供，依订购数量而定。',
      ingredients: '成分：精炼棕榈油（国际化妆品成分命名 INCI：Elaeis Guineensis Oil）。',
      usage: '可用作皂类、化妆品生产原料，或依业务需求转售分销。',
      benefits: [BULK_BENEFIT_ZH, CONSISTENCY_BENEFIT_ZH, { text: '质地浓稠，天然富含维生素E与脂肪酸', claimType: 'factual' }],
      warnings: [...BASE_WARNINGS_ZH],
    },
  },
  {
    slug: 'peanut-oil-bulk',
    botanicalName: 'Arachis Hypogaea (Peanut) Oil',
    extractionMethod: 'refined',
    sku: 'PN-20L',
    vi: {
      name: 'Dầu đậu phộng (thùng 20L)',
      shortDescription: 'Dầu đậu phộng tinh luyện, đóng thùng 20 lít — dành cho cơ sở sản xuất và khách hàng doanh nghiệp.',
      description: 'Cùng loại dầu đậu phộng tinh luyện như dòng bán lẻ, giàu axit béo không bão hòa đơn, đóng trong thùng nhựa 20 lít phù hợp cho cơ sở sản xuất mỹ phẩm hoặc đơn vị phân phối lại. Giá bán theo báo giá, tùy số lượng đặt hàng.',
      ingredients: 'Thành phần: Dầu đậu phộng tinh luyện (tên gọi quốc tế theo quy ước INCI: Arachis Hypogaea Oil).',
      usage: 'Dùng làm nguyên liệu trong sản xuất mỹ phẩm, pha chế sản phẩm massage, hoặc phân phối lại theo nhu cầu kinh doanh.',
      benefits: [BULK_BENEFIT_VI, CONSISTENCY_BENEFIT_VI, { text: 'Giàu axit béo không bão hòa đơn', claimType: 'factual' }],
      warnings: [...BASE_WARNINGS_VI, PEANUT_ALLERGY_VI],
    },
    zh: {
      name: '花生油（20L桶装）',
      shortDescription: '精炼花生油，20升整桶装——为生产企业及批发客户提供。',
      description: '与零售系列成分相同的精炼花生油，富含单不饱和脂肪酸，装于20升塑料桶中，适合化妆品生产商或经销商采购。价格按报价提供，依订购数量而定。',
      ingredients: '成分：精炼花生油（国际化妆品成分命名 INCI：Arachis Hypogaea Oil）。',
      usage: '可用作化妆品生产原料、按摩护理产品调配，或依业务需求转售分销。',
      benefits: [BULK_BENEFIT_ZH, CONSISTENCY_BENEFIT_ZH, { text: '富含单不饱和脂肪酸', claimType: 'factual' }],
      warnings: [...BASE_WARNINGS_ZH, PEANUT_ALLERGY_ZH],
    },
  },
  {
    slug: 'rice-bran-oil-bulk',
    botanicalName: 'Oryza Sativa (Rice) Bran Oil',
    extractionMethod: 'refined',
    sku: 'RB-20L',
    vi: {
      name: 'Dầu cám gạo (thùng 20L)',
      shortDescription: 'Dầu cám gạo tinh luyện, đóng thùng 20 lít — giàu vitamin E, dành cho khách hàng doanh nghiệp.',
      description: 'Cùng loại dầu cám gạo như dòng bán lẻ, giàu vitamin E và gamma-oryzanol tự nhiên, đóng trong thùng nhựa 20 lít phù hợp cho cơ sở sản xuất mỹ phẩm hoặc đơn vị phân phối lại. Giá bán theo báo giá, tùy số lượng đặt hàng.',
      ingredients: 'Thành phần: Dầu cám gạo (tên gọi quốc tế theo quy ước INCI: Oryza Sativa Bran Oil).',
      usage: 'Dùng làm nguyên liệu trong sản xuất mỹ phẩm, pha chế sản phẩm chăm sóc da/tóc, hoặc phân phối lại theo nhu cầu kinh doanh.',
      benefits: [BULK_BENEFIT_VI, CONSISTENCY_BENEFIT_VI, { text: 'Chứa vitamin E và gamma-oryzanol tự nhiên', claimType: 'factual' }],
      warnings: [...BASE_WARNINGS_VI],
    },
    zh: {
      name: '米糠油（20L桶装）',
      shortDescription: '米糠油，20升整桶装——天然富含维生素E，为企业客户提供。',
      description: '与零售系列成分相同的米糠油，天然含有维生素E与谷维素，装于20升塑料桶中，适合化妆品生产商或经销商采购。价格按报价提供，依订购数量而定。',
      ingredients: '成分：米糠油（国际化妆品成分命名 INCI：Oryza Sativa Bran Oil）。',
      usage: '可用作化妆品生产原料、护肤护发产品调配，或依业务需求转售分销。',
      benefits: [BULK_BENEFIT_ZH, CONSISTENCY_BENEFIT_ZH, { text: '天然含有维生素E与谷维素', claimType: 'factual' }],
      warnings: [...BASE_WARNINGS_ZH],
    },
  },
  {
    slug: 'sesame-oil-bulk',
    botanicalName: 'Sesamum Indicum (Sesame) Seed Oil',
    extractionMethod: 'cold-pressed',
    sku: 'SE-20L',
    vi: {
      name: 'Dầu mè (thùng 20L)',
      shortDescription: 'Dầu mè ép lạnh, đóng thùng 20 lít — giàu vitamin E và sesamin, dành cho khách hàng doanh nghiệp.',
      description: 'Cùng loại dầu mè ép lạnh như dòng bán lẻ, giàu vitamin E và sesamin, đóng trong thùng nhựa 20 lít phù hợp cho cơ sở sản xuất mỹ phẩm, spa hoặc đơn vị phân phối lại. Giá bán theo báo giá, tùy số lượng đặt hàng.',
      ingredients: 'Thành phần: Dầu mè ép lạnh (tên gọi quốc tế theo quy ước INCI: Sesamum Indicum Seed Oil).',
      usage: 'Dùng làm nguyên liệu trong sản xuất mỹ phẩm, pha chế sản phẩm massage, hoặc phân phối lại theo nhu cầu kinh doanh.',
      benefits: [BULK_BENEFIT_VI, CONSISTENCY_BENEFIT_VI, { text: 'Giàu vitamin E và sesamin — chất chống oxy hóa tự nhiên', claimType: 'factual' }],
      warnings: [...BASE_WARNINGS_VI],
    },
    zh: {
      name: '芝麻油（20L桶装）',
      shortDescription: '冷压芝麻油，20升整桶装——富含维生素E与芝麻素，为企业客户提供。',
      description: '与零售系列成分相同的冷压芝麻油，天然富含维生素E与芝麻素，装于20升塑料桶中，适合化妆品生产商、水疗中心或经销商采购。价格按报价提供，依订购数量而定。',
      ingredients: '成分：冷压芝麻油（国际化妆品成分命名 INCI：Sesamum Indicum Seed Oil）。',
      usage: '可用作化妆品生产原料、按摩护理产品调配，或依业务需求转售分销。',
      benefits: [BULK_BENEFIT_ZH, CONSISTENCY_BENEFIT_ZH, { text: '富含维生素E与芝麻素等天然抗氧化成分', claimType: 'factual' }],
      warnings: [...BASE_WARNINGS_ZH],
    },
  },
  {
    slug: 'olive-oil-bulk',
    botanicalName: 'Olea Europaea (Olive) Fruit Oil',
    extractionMethod: 'cold-pressed',
    sku: 'OL-20L',
    vi: {
      name: 'Dầu olive (thùng 20L)',
      shortDescription: 'Dầu olive ép lạnh nguyên chất, đóng thùng 20 lít — giàu vitamin E và chất chống oxy hóa, dành cho khách hàng doanh nghiệp.',
      description: 'Cùng loại dầu olive ép lạnh nguyên chất như dòng bán lẻ, giàu vitamin E và polyphenol, đóng trong thùng nhựa 20 lít phù hợp cho cơ sở sản xuất mỹ phẩm, spa hoặc đơn vị phân phối lại. Giá bán theo báo giá, tùy số lượng đặt hàng.',
      ingredients: 'Thành phần: Dầu olive ép lạnh nguyên chất (tên gọi quốc tế theo quy ước INCI: Olea Europaea Fruit Oil).',
      usage: 'Dùng làm nguyên liệu trong sản xuất mỹ phẩm, pha chế sản phẩm chăm sóc da/tóc, hoặc phân phối lại theo nhu cầu kinh doanh.',
      benefits: [BULK_BENEFIT_VI, CONSISTENCY_BENEFIT_VI, { text: 'Giàu vitamin E và polyphenol chống oxy hóa tự nhiên', claimType: 'factual' }],
      warnings: [...BASE_WARNINGS_VI],
    },
    zh: {
      name: '橄榄油（20L桶装）',
      shortDescription: '冷压初榨橄榄油，20升整桶装——富含维生素E与天然抗氧化成分，为企业客户提供。',
      description: '与零售系列成分相同的冷压初榨橄榄油，天然富含维生素E及多酚类抗氧化成分，装于20升塑料桶中，适合化妆品生产商、水疗中心或经销商采购。价格按报价提供，依订购数量而定。',
      ingredients: '成分：冷压初榨橄榄油（国际化妆品成分命名 INCI：Olea Europaea Fruit Oil）。',
      usage: '可用作化妆品生产原料、护肤护发产品调配，或依业务需求转售分销。',
      benefits: [BULK_BENEFIT_ZH, CONSISTENCY_BENEFIT_ZH, { text: '天然富含维生素E与多酚类抗氧化成分', claimType: 'factual' }],
      warnings: [...BASE_WARNINGS_ZH],
    },
  },
];

async function main() {
  console.log(`Seeding ${PRODUCTS.length} wholesale (bulk 20L) products into the '${CATEGORY_ID}' category...`);

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
        sortOrder: index,
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
          sortOrder: index,
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
    // Deliberately no `pricing` insert here -- see the file-level doc
    // comment on why every one of these 9 products is meant to render
    // as "price on request".

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
    `\nDone. Seeded ${PRODUCTS.length} wholesale products (20 L drums), each with a SKU but ` +
    `deliberately NO price row (renders as "price on request"). Certifications and real ` +
    `photography remain untouched/NULL.`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('Wholesale products seed failed:', err);
  process.exit(1);
});
