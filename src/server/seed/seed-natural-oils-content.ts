/**
 * Populates real, researched VI/ZH content for the remaining 18 Natural
 * Oils products that only had a name so far (see seed-natural-oils.ts —
 * that script seeded id/slug/name only, deliberately with no variant,
 * pricing, or content rows). Coconut Oil already got this treatment in
 * seed-coconut-oil-content.ts and is NOT touched again here.
 *
 * PROVENANCE, PER FIELD — same three-category split as
 * seed-coconut-oil-content.ts:
 *
 *   (A) GENERIC RESEARCH-DERIVED FACTUAL CONTENT — botanical name,
 *       extraction method, and the specific benefit/warning lines tagged
 *       `claimType: 'factual'` are true of each oil as a substance in
 *       general. Comedogenic-tendency language and the nut/legume/soy
 *       allergen warnings are grounded in commonly cited skincare
 *       references (Vinevida's and Nature Coast Apothecary's comedogenic
 *       guides; anaphylaxis.org.uk's peanut-oil fact sheet on refined
 *       arachis oil) — see the PR/commit description for links. Where a
 *       source did not give a specific numeric rating for an oil, the
 *       warning stays qualitative rather than inventing a number.
 *
 *   (B) GENERATED MARKETING WORDING — cosmetic/sensory phrasing
 *       (lightweight texture, "suits X skin type", etc.), tagged
 *       `claimType: 'marketing'` in every case, never `'structure_function'`
 *       (same posture as coconut oil — no disease/treatment claim
 *       anywhere in this file).
 *
 *   (C) FABRICATED BUSINESS FACTS — SKU, variant size/container, VND
 *       price, manufacturer name, and country of origin are placeholder
 *       values, NOT real supplier data. Explicitly approved for this
 *       batch (unlike Coconut Oil, where these were real business input) —
 *       see chat: "Bạn có thể fake giá/sku nhé". Manufacturer name
 *       ('ABC Company') and country ('VN') reuse the exact same
 *       placeholders Coconut Oil already uses, for catalog consistency.
 *       Replace all of this with real supplier facts once they exist —
 *       nothing here should be mistaken for a real quote.
 *
 * `extractionMethod` values are deliberately restricted to the 4 keys
 * `formatExtractionMethod` (src/lib/product-metadata-labels.ts) knows how
 * to translate: 'cold-pressed' | 'expeller-pressed' | 'refined' |
 * 'virgin-unrefined'. `countryOfOriginCode` stays 'VN' (also a known key
 * in `formatCountryOfOrigin`).
 *
 * Safe to re-run: every insert uses ON CONFLICT DO UPDATE / deterministic
 * ids, matching seed-coconut-oil-content.ts's pattern exactly.
 */
import { and, eq } from 'drizzle-orm';
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

type ClaimType = 'factual' | 'marketing';
interface LocaleContent {
  shortDescription: string;
  description: string;
  ingredients: string;
  usage: string;
  benefits: { text: string; claimType: ClaimType }[];
  warnings: string[];
}
interface ProductSeed {
  id: string;
  botanicalName: string;
  extractionMethod: 'cold-pressed' | 'expeller-pressed' | 'refined' | 'virgin-unrefined';
  variant: { sku: string; netQuantityValue: string; netQuantityUnit: 'ml'; containerType: string };
  priceMinor: number;
  vi: LocaleContent;
  zh: LocaleContent;
}

const COUNTRY = 'VN';
const MANUFACTURER = 'ABC Company';

// Shared boilerplate safety lines (mirrors seed-coconut-oil-content.ts's
// first 3 warnings on every product there) — every product below starts
// from these and appends 0-2 oil-specific lines.
const BASE_WARNINGS_VI = [
  'Chỉ dùng ngoài da.',
  'Nên thử trên một vùng da nhỏ trước khi sử dụng rộng rãi để kiểm tra phản ứng.',
  'Ngưng sử dụng nếu xuất hiện dấu hiệu kích ứng, mẩn đỏ hoặc khó chịu.',
];
const BASE_WARNINGS_ZH = [
  '仅供外用。',
  '建议先于小范围肌肤测试，确认无不良反应后再大面积使用。',
  '若出现刺激、泛红或不适，请立即停止使用。',
];

const COMEDOGENIC_NOTE_VI = 'Có kết cấu hơi đặc, có thể gây bít lỗ chân lông ở một số loại da — cân nhắc trước khi dùng cho da mặt dễ nổi mụn.';
const COMEDOGENIC_NOTE_ZH = '质地较为浓稠，可能造成部分肤质毛孔堵塞——痘痘肌或易长粉刺者使用前应谨慎考虑。';

const PEANUT_ALLERGY_VI = 'Chiết xuất từ đậu phộng — người có tiền sử dị ứng đậu phộng nên thận trọng, đặc biệt khi dùng cho trẻ nhỏ hoặc vùng da tổn thương; nên hỏi ý kiến bác sĩ trước khi sử dụng.';
const PEANUT_ALLERGY_ZH = '本品萃取自花生——有花生过敏史者应谨慎使用，尤其避免用于幼儿或受损肌肤，建议使用前咨询医生。';

const SOY_ALLERGY_VI = 'Chiết xuất từ đậu nành — người có tiền sử dị ứng đậu nành nên thận trọng khi sử dụng.';
const SOY_ALLERGY_ZH = '本品萃取自大豆——有大豆过敏史者使用时应谨慎。';

const TREE_NUT_ALLERGY_VI = 'Chiết xuất từ hạt cây — người có tiền sử dị ứng các loại hạt (đậu phộng, hạnh nhân, óc chó, mắc ca...) nên thận trọng khi sử dụng.';
const TREE_NUT_ALLERGY_ZH = '本品萃取自坚果——对坚果类（花生、杏仁、核桃、夏威夷果等）过敏者使用时应谨慎。';

const OXIDATION_NOTE_VI = 'Dễ oxy hóa hơn một số loại dầu khác — nên bảo quản nơi khô mát, tránh ánh nắng trực tiếp và dùng hết trong thời gian ngắn sau khi mở nắp.';
const OXIDATION_NOTE_ZH = '相较其他油品更易氧化——请存放于阴凉干燥处，避免阳光直射，并在开封后尽快用完。';

const PRODUCTS: ProductSeed[] = [
  // ---------------------------------------------------------------------
  {
    id: 'natural-oils:rice-bran-oil',
    botanicalName: 'Oryza Sativa (Rice) Bran Oil',
    extractionMethod: 'refined',
    variant: { sku: 'RB-100', netQuantityValue: '100', netQuantityUnit: 'ml', containerType: 'amber-glass' },
    priceMinor: 150000,
    vi: {
      shortDescription: 'Dầu cám gạo có kết cấu nhẹ, dễ thấm, giàu vitamin E tự nhiên — nguyên liệu quen thuộc trong chăm sóc da và tóc tại nhiều nước châu Á.',
      description: 'Dầu cám gạo được chiết xuất từ lớp cám bên ngoài hạt gạo, chứa vitamin E và gamma-oryzanol tự nhiên. Với kết cấu nhẹ và khả năng thấm nhanh, đây là nguyên liệu phổ biến trong các sản phẩm dưỡng da và tóc ở Nhật Bản cũng như nhiều nước châu Á khác.',
      ingredients: 'Thành phần: Dầu cám gạo (tên gọi quốc tế theo quy ước INCI: Oryza Sativa Bran Oil).',
      usage: 'Thoa một lượng nhỏ lên da hoặc tóc sau khi làm sạch, có thể dùng trực tiếp hoặc kết hợp trong quy trình dưỡng da hằng ngày.',
      benefits: [
        { text: 'Kết cấu nhẹ, thấm nhanh, không gây bết dính', claimType: 'marketing' },
        { text: 'Chứa vitamin E và gamma-oryzanol tự nhiên', claimType: 'factual' },
        { text: 'Phù hợp dùng cho cả da và tóc', claimType: 'marketing' },
      ],
      warnings: [...BASE_WARNINGS_VI, 'Người có làn da nhạy cảm nên thử phản ứng trước khi dùng cho vùng da rộng.'],
    },
    zh: {
      shortDescription: '米糠油质地轻盈、易吸收，天然富含维生素E，是亚洲多国护肤护发中常见的选择。',
      description: '米糠油萃取自稻米外层的米糠部分，天然含有维生素E与谷维素（gamma-oryzanol）。质地轻盈、吸收迅速，是日本及其他亚洲国家护肤护发产品中常见的原料。',
      ingredients: '成分：米糠油（国际化妆品成分命名 INCI：Oryza Sativa Bran Oil）。',
      usage: '洁面后取适量涂抹于肌肤或头发，可直接使用，也可融入日常护理步骤。',
      benefits: [
        { text: '质地轻盈、吸收迅速，不易黏腻', claimType: 'marketing' },
        { text: '天然含有维生素E与谷维素', claimType: 'factual' },
        { text: '适合用于肌肤与头发护理', claimType: 'marketing' },
      ],
      warnings: [...BASE_WARNINGS_ZH, '肌肤敏感者建议先在小范围测试后再大面积使用。'],
    },
  },
  // ---------------------------------------------------------------------
  {
    id: 'natural-oils:peanut-oil',
    botanicalName: 'Arachis Hypogaea (Peanut) Oil',
    extractionMethod: 'refined',
    variant: { sku: 'PN-100', netQuantityValue: '100', netQuantityUnit: 'ml', containerType: 'amber-glass' },
    priceMinor: 140000,
    vi: {
      shortDescription: 'Dầu đậu phộng tinh luyện có kết cấu vừa phải, được dùng phổ biến trong dưỡng da và massage.',
      description: 'Dầu đậu phộng được ép và tinh luyện từ hạt đậu phộng, giàu axit béo không bão hòa đơn. Dạng tinh luyện thường được sử dụng trong dưỡng da và massage nhờ kết cấu êm và khả năng làm mềm da.',
      ingredients: 'Thành phần: Dầu đậu phộng tinh luyện (tên gọi quốc tế theo quy ước INCI: Arachis Hypogaea Oil).',
      usage: 'Thoa một lượng vừa đủ lên da và massage nhẹ nhàng theo chuyển động tròn cho đến khi thấm.',
      benefits: [
        { text: 'Làm mềm da, hỗ trợ dưỡng ẩm', claimType: 'marketing' },
        { text: 'Giàu axit béo không bão hòa đơn', claimType: 'factual' },
        { text: 'Kết cấu êm, phù hợp dùng khi massage', claimType: 'marketing' },
      ],
      warnings: [...BASE_WARNINGS_VI, PEANUT_ALLERGY_VI],
    },
    zh: {
      shortDescription: '精炼花生油质地适中，常用于护肤与按摩护理。',
      description: '花生油由花生仁压榨并精炼而成，富含单不饱和脂肪酸。精炼花生油因质地温和、柔滑肌肤的特性，常被用于护肤及按摩护理。',
      ingredients: '成分：精炼花生油（国际化妆品成分命名 INCI：Arachis Hypogaea Oil）。',
      usage: '取适量涂抹于肌肤，以打圈方式轻轻按摩至吸收。',
      benefits: [
        { text: '柔软肌肤，有助保湿', claimType: 'marketing' },
        { text: '富含单不饱和脂肪酸', claimType: 'factual' },
        { text: '质地温和，适合按摩护理使用', claimType: 'marketing' },
      ],
      warnings: [...BASE_WARNINGS_ZH, PEANUT_ALLERGY_ZH],
    },
  },
  // ---------------------------------------------------------------------
  {
    id: 'natural-oils:sunflower-oil',
    botanicalName: 'Helianthus Annuus (Sunflower) Seed Oil',
    extractionMethod: 'cold-pressed',
    variant: { sku: 'SF-100', netQuantityValue: '100', netQuantityUnit: 'ml', containerType: 'amber-glass' },
    priceMinor: 130000,
    vi: {
      shortDescription: 'Dầu hướng dương ép lạnh có kết cấu nhẹ, ít gây bít lỗ chân lông, giàu vitamin E và axit linoleic.',
      description: 'Dầu hướng dương được ép lạnh từ hạt hướng dương, giàu vitamin E và axit linoleic — một axit béo hỗ trợ hàng rào bảo vệ da tự nhiên. Kết cấu nhẹ, dễ thấm khiến đây là lựa chọn phù hợp cho nhiều loại da, kể cả da dầu.',
      ingredients: 'Thành phần: Dầu hướng dương ép lạnh (tên gọi quốc tế theo quy ước INCI: Helianthus Annuus Seed Oil).',
      usage: 'Thoa một lượng nhỏ lên da sau bước làm sạch, có thể dùng riêng hoặc pha cùng các loại dầu khác.',
      benefits: [
        { text: 'Kết cấu nhẹ, ít gây bít lỗ chân lông, phù hợp cả da dầu', claimType: 'factual' },
        { text: 'Giàu vitamin E và axit linoleic tự nhiên', claimType: 'factual' },
        { text: 'Hỗ trợ làn da mềm mại, dễ chịu hơn', claimType: 'marketing' },
      ],
      warnings: [...BASE_WARNINGS_VI],
    },
    zh: {
      shortDescription: '冷压葵花籽油质地轻盈、致痘性低，富含维生素E与亚油酸。',
      description: '葵花籽油以冷压方式萃取，富含维生素E与亚油酸——一种有助支持肌肤天然屏障的脂肪酸。质地轻盈易吸收，适合包括油性肌肤在内的多种肤质。',
      ingredients: '成分：冷压葵花籽油（国际化妆品成分命名 INCI：Helianthus Annuus Seed Oil）。',
      usage: '洁面后取适量涂抹于肌肤，可单独使用，也可与其他油品调和使用。',
      benefits: [
        { text: '质地轻盈、致痘性低，适合油性肌肤', claimType: 'factual' },
        { text: '天然富含维生素E与亚油酸', claimType: 'factual' },
        { text: '有助肌肤更加柔软舒适', claimType: 'marketing' },
      ],
      warnings: [...BASE_WARNINGS_ZH],
    },
  },
  // ---------------------------------------------------------------------
  {
    id: 'natural-oils:soybean-oil',
    botanicalName: 'Glycine Soja (Soybean) Oil',
    extractionMethod: 'refined',
    variant: { sku: 'SB-100', netQuantityValue: '100', netQuantityUnit: 'ml', containerType: 'amber-glass' },
    priceMinor: 120000,
    vi: {
      shortDescription: 'Dầu đậu nành tinh luyện có kết cấu nhẹ, giàu vitamin E, thường dùng làm dầu nền trong chăm sóc da.',
      description: 'Dầu đậu nành được ép và tinh luyện từ hạt đậu nành, giàu axit linoleic và vitamin E tự nhiên. Kết cấu nhẹ khiến dầu đậu nành thường được dùng làm dầu nền (carrier oil) trong các công thức chăm sóc da.',
      ingredients: 'Thành phần: Dầu đậu nành tinh luyện (tên gọi quốc tế theo quy ước INCI: Glycine Soja Oil).',
      usage: 'Thoa một lượng nhỏ lên da, có thể dùng riêng hoặc làm dầu nền pha cùng tinh dầu khác.',
      benefits: [
        { text: 'Kết cấu nhẹ, thường dùng làm dầu nền', claimType: 'marketing' },
        { text: 'Giàu axit linoleic và vitamin E tự nhiên', claimType: 'factual' },
        { text: 'Hỗ trợ dưỡng ẩm nhẹ nhàng cho da', claimType: 'marketing' },
      ],
      warnings: [...BASE_WARNINGS_VI, SOY_ALLERGY_VI],
    },
    zh: {
      shortDescription: '精炼大豆油质地轻盈，富含维生素E，常作为护肤配方中的基础油使用。',
      description: '大豆油由大豆压榨并精炼而成，天然富含亚油酸与维生素E。质地轻盈，常被用作护肤配方中的基础油（carrier oil）。',
      ingredients: '成分：精炼大豆油（国际化妆品成分命名 INCI：Glycine Soja Oil）。',
      usage: '取适量涂抹于肌肤，可单独使用，也可作为基础油与其他精油调和。',
      benefits: [
        { text: '质地轻盈，常用作护肤基础油', claimType: 'marketing' },
        { text: '天然富含亚油酸与维生素E', claimType: 'factual' },
        { text: '有助为肌肤带来温和滋润', claimType: 'marketing' },
      ],
      warnings: [...BASE_WARNINGS_ZH, SOY_ALLERGY_ZH],
    },
  },
  // ---------------------------------------------------------------------
  {
    id: 'natural-oils:canola-oil',
    botanicalName: 'Brassica Napus (Canola) Seed Oil',
    extractionMethod: 'expeller-pressed',
    variant: { sku: 'CN-100', netQuantityValue: '100', netQuantityUnit: 'ml', containerType: 'amber-glass' },
    priceMinor: 135000,
    vi: {
      shortDescription: 'Dầu cải ép cơ học có kết cấu nhẹ, trung tính, ít mùi — phù hợp làm dầu nền hằng ngày.',
      description: 'Dầu cải (canola) được ép cơ học từ hạt cải, có kết cấu nhẹ và mùi trung tính, ít gây khó chịu. Đây là một lựa chọn dầu nền phổ biến nhờ tính chất ổn định và dễ kết hợp với các sản phẩm chăm sóc da khác.',
      ingredients: 'Thành phần: Dầu cải ép cơ học (tên gọi quốc tế theo quy ước INCI: Brassica Napus Seed Oil).',
      usage: 'Thoa một lượng nhỏ lên da, có thể dùng riêng hoặc pha cùng các loại dầu, tinh dầu khác.',
      benefits: [
        { text: 'Kết cấu nhẹ, mùi trung tính, dễ chịu', claimType: 'marketing' },
        { text: 'Ổn định, phù hợp làm dầu nền', claimType: 'marketing' },
        { text: 'Chứa vitamin E tự nhiên', claimType: 'factual' },
      ],
      warnings: [...BASE_WARNINGS_VI],
    },
    zh: {
      shortDescription: '机榨菜籽油质地轻盈、气味温和，是日常护理中常见的基础油之一。',
      description: '菜籽油（canola）以机械压榨方式萃取，质地轻盈、气味温和不刺鼻。因性质稳定、易与其他护肤产品调和，是常见的基础油选择之一。',
      ingredients: '成分：机榨菜籽油（国际化妆品成分命名 INCI：Brassica Napus Seed Oil）。',
      usage: '取适量涂抹于肌肤，可单独使用，也可与其他油品或精油调和使用。',
      benefits: [
        { text: '质地轻盈，气味温和不刺鼻', claimType: 'marketing' },
        { text: '性质稳定，适合作为基础油', claimType: 'marketing' },
        { text: '天然含有维生素E', claimType: 'factual' },
      ],
      warnings: [...BASE_WARNINGS_ZH],
    },
  },
  // ---------------------------------------------------------------------
  {
    id: 'natural-oils:palm-oil',
    botanicalName: 'Elaeis Guineensis (Palm) Oil',
    extractionMethod: 'refined',
    variant: { sku: 'PL-100', netQuantityValue: '100', netQuantityUnit: 'ml', containerType: 'amber-glass' },
    priceMinor: 110000,
    vi: {
      shortDescription: 'Dầu cọ tinh luyện có kết cấu đặc, giàu vitamin E, thường dùng làm nguyên liệu trong các sản phẩm chăm sóc da.',
      description: 'Dầu cọ được ép từ phần thịt quả cọ và tinh luyện, giàu axit béo bão hòa và vitamin E tự nhiên. Kết cấu đặc hơn các loại dầu thực vật khác khiến dầu cọ thường được dùng làm nguyên liệu nền trong xà phòng và các sản phẩm chăm sóc da đặc.',
      ingredients: 'Thành phần: Dầu cọ tinh luyện (tên gọi quốc tế theo quy ước INCI: Elaeis Guineensis Oil).',
      usage: 'Thoa một lượng nhỏ lên da, phù hợp dùng làm nguyên liệu pha chế hoặc dưỡng vùng da khô.',
      benefits: [
        { text: 'Giàu vitamin E và axit béo tự nhiên', claimType: 'factual' },
        { text: 'Kết cấu đặc, phù hợp dưỡng vùng da khô', claimType: 'marketing' },
        { text: 'Hỗ trợ làm mềm da', claimType: 'marketing' },
      ],
      warnings: [...BASE_WARNINGS_VI, COMEDOGENIC_NOTE_VI],
    },
    zh: {
      shortDescription: '精炼棕榈油质地浓稠，天然富含维生素E，常作为护肤产品的原料使用。',
      description: '棕榈油萃取自棕榈果肉并经过精炼，天然富含饱和脂肪酸与维生素E。质地比多数植物油更为浓稠，常被用作皂类及浓润护肤产品的基础原料。',
      ingredients: '成分：精炼棕榈油（国际化妆品成分命名 INCI：Elaeis Guineensis Oil）。',
      usage: '取适量涂抹于肌肤，适合作为调配原料或用于干燥部位的滋润护理。',
      benefits: [
        { text: '天然富含维生素E与脂肪酸', claimType: 'factual' },
        { text: '质地浓稠，适合滋润干燥部位', claimType: 'marketing' },
        { text: '有助肌肤更加柔软', claimType: 'marketing' },
      ],
      warnings: [...BASE_WARNINGS_ZH, COMEDOGENIC_NOTE_ZH],
    },
  },
  // ---------------------------------------------------------------------
  {
    id: 'natural-oils:sesame-oil',
    botanicalName: 'Sesamum Indicum (Sesame) Seed Oil',
    extractionMethod: 'cold-pressed',
    variant: { sku: 'SE-100', netQuantityValue: '100', netQuantityUnit: 'ml', containerType: 'amber-glass' },
    priceMinor: 230000,
    vi: {
      shortDescription: 'Dầu mè ép lạnh giàu vitamin E và sesamin, được dùng lâu đời trong massage và chăm sóc da.',
      description: 'Dầu mè ép lạnh từ hạt mè, giàu vitamin E và sesamin — một hợp chất chống oxy hóa tự nhiên có trong hạt mè. Dầu mè có lịch sử sử dụng lâu đời trong các liệu pháp massage truyền thống nhờ kết cấu ấm và dễ thấm.',
      ingredients: 'Thành phần: Dầu mè ép lạnh (tên gọi quốc tế theo quy ước INCI: Sesamum Indicum Seed Oil).',
      usage: 'Làm ấm nhẹ giữa hai lòng bàn tay rồi thoa lên da, massage nhẹ nhàng theo chuyển động tròn cho đến khi thấm.',
      benefits: [
        { text: 'Giàu vitamin E và sesamin — chất chống oxy hóa tự nhiên', claimType: 'factual' },
        { text: 'Kết cấu ấm, phù hợp dùng khi massage', claimType: 'marketing' },
        { text: 'Hỗ trợ dưỡng ẩm cho da khô', claimType: 'marketing' },
      ],
      warnings: [...BASE_WARNINGS_VI, COMEDOGENIC_NOTE_VI],
    },
    zh: {
      shortDescription: '冷压芝麻油富含维生素E与芝麻素，自古以来常用于按摩与护肤。',
      description: '芝麻油以冷压方式萃取自芝麻籽，天然富含维生素E与芝麻素（sesamin）等抗氧化成分。因质地温润、易于推展，长期以来被用于传统按摩护理。',
      ingredients: '成分：冷压芝麻油（国际化妆品成分命名 INCI：Sesamum Indicum Seed Oil）。',
      usage: '取适量于掌心稍稍温热后涂抹于肌肤，以打圈方式轻轻按摩至吸收。',
      benefits: [
        { text: '富含维生素E与芝麻素等天然抗氧化成分', claimType: 'factual' },
        { text: '质地温润，适合按摩护理使用', claimType: 'marketing' },
        { text: '有助滋润干燥肌肤', claimType: 'marketing' },
      ],
      warnings: [...BASE_WARNINGS_ZH, COMEDOGENIC_NOTE_ZH],
    },
  },
  // ---------------------------------------------------------------------
  {
    id: 'natural-oils:olive-oil',
    botanicalName: 'Olea Europaea (Olive) Fruit Oil',
    extractionMethod: 'cold-pressed',
    variant: { sku: 'OL-100', netQuantityValue: '100', netQuantityUnit: 'ml', containerType: 'amber-glass' },
    priceMinor: 290000,
    vi: {
      shortDescription: 'Dầu olive ép lạnh nguyên chất giàu vitamin E và chất chống oxy hóa, quen thuộc trong dưỡng da và tóc.',
      description: 'Dầu olive được ép lạnh trực tiếp từ quả olive, giàu vitamin E và các hợp chất polyphenol chống oxy hóa tự nhiên. Đây là một trong những loại dầu thực vật được nghiên cứu và sử dụng rộng rãi nhất trong chăm sóc da và tóc.',
      ingredients: 'Thành phần: Dầu olive ép lạnh nguyên chất (tên gọi quốc tế theo quy ước INCI: Olea Europaea Fruit Oil).',
      usage: 'Thoa một lượng nhỏ lên da hoặc tóc sau khi làm sạch, có thể dùng trực tiếp hoặc kết hợp trong quy trình dưỡng hằng ngày.',
      benefits: [
        { text: 'Giàu vitamin E và polyphenol chống oxy hóa tự nhiên', claimType: 'factual' },
        { text: 'Hỗ trợ dưỡng ẩm sâu cho da khô', claimType: 'marketing' },
        { text: 'Phù hợp dùng cho cả da và tóc', claimType: 'marketing' },
      ],
      warnings: [...BASE_WARNINGS_VI, COMEDOGENIC_NOTE_VI],
    },
    zh: {
      shortDescription: '冷压初榨橄榄油富含维生素E与天然抗氧化成分，是护肤护发中的常见选择。',
      description: '橄榄油直接冷压萃取自橄榄果实，天然富含维生素E及多酚类抗氧化成分。作为研究与应用最广泛的植物油之一，橄榄油常见于护肤与护发产品中。',
      ingredients: '成分：冷压初榨橄榄油（国际化妆品成分命名 INCI：Olea Europaea Fruit Oil）。',
      usage: '洁面后取适量涂抹于肌肤或头发，可直接使用，也可融入日常护理步骤。',
      benefits: [
        { text: '天然富含维生素E与多酚类抗氧化成分', claimType: 'factual' },
        { text: '有助深层滋润干燥肌肤', claimType: 'marketing' },
        { text: '适合用于肌肤与头发护理', claimType: 'marketing' },
      ],
      warnings: [...BASE_WARNINGS_ZH, COMEDOGENIC_NOTE_ZH],
    },
  },
  // ---------------------------------------------------------------------
  {
    id: 'natural-oils:avocado-oil',
    botanicalName: 'Persea Gratissima (Avocado) Oil',
    extractionMethod: 'cold-pressed',
    variant: { sku: 'AV-100', netQuantityValue: '100', netQuantityUnit: 'ml', containerType: 'amber-glass' },
    priceMinor: 340000,
    vi: {
      shortDescription: 'Dầu bơ (avocado) ép lạnh có kết cấu giàu dưỡng chất, thường được chọn cho da khô và cần phục hồi.',
      description: 'Dầu bơ được ép lạnh từ phần thịt quả bơ, giàu vitamin E và axit oleic. Kết cấu đậm đặc hơn nhiều loại dầu nhẹ khác khiến dầu bơ thường được lựa chọn cho các vùng da khô hoặc cần dưỡng ẩm chuyên sâu.',
      ingredients: 'Thành phần: Dầu bơ ép lạnh (tên gọi quốc tế theo quy ước INCI: Persea Gratissima Oil).',
      usage: 'Thoa một lượng nhỏ lên vùng da khô sau khi làm sạch, có thể dùng riêng hoặc pha cùng dầu nền nhẹ hơn.',
      benefits: [
        { text: 'Giàu vitamin E và axit oleic tự nhiên', claimType: 'factual' },
        { text: 'Hỗ trợ dưỡng ẩm chuyên sâu cho da khô', claimType: 'marketing' },
        { text: 'Kết cấu đậm đặc, giàu dưỡng chất', claimType: 'marketing' },
      ],
      warnings: [...BASE_WARNINGS_VI, COMEDOGENIC_NOTE_VI],
    },
    zh: {
      shortDescription: '冷压牛油果油质地丰润，常被选用于干燥及需要修护的肌肤。',
      description: '牛油果油冷压萃取自牛油果果肉，天然富含维生素E与油酸。质地比多数轻盈油品更为丰润，常被用于干燥部位或需要深层滋润的肌肤护理。',
      ingredients: '成分：冷压牛油果油（国际化妆品成分命名 INCI：Persea Gratissima Oil）。',
      usage: '洁面后取适量涂抹于干燥部位，可单独使用，也可与质地较轻的基础油调和。',
      benefits: [
        { text: '天然富含维生素E与油酸', claimType: 'factual' },
        { text: '有助深层滋润干燥肌肤', claimType: 'marketing' },
        { text: '质地丰润，滋养感十足', claimType: 'marketing' },
      ],
      warnings: [...BASE_WARNINGS_ZH, COMEDOGENIC_NOTE_ZH],
    },
  },
  // ---------------------------------------------------------------------
  {
    id: 'natural-oils:grapeseed-oil',
    botanicalName: 'Vitis Vinifera (Grape) Seed Oil',
    extractionMethod: 'expeller-pressed',
    variant: { sku: 'GS-100', netQuantityValue: '100', netQuantityUnit: 'ml', containerType: 'amber-glass' },
    priceMinor: 260000,
    vi: {
      shortDescription: 'Dầu hạt nho có kết cấu rất nhẹ, ít gây bít lỗ chân lông, giàu axit linoleic và chất chống oxy hóa.',
      description: 'Dầu hạt nho được ép từ hạt nho — phụ phẩm của quá trình sản xuất rượu vang — giàu axit linoleic và các hợp chất polyphenol chống oxy hóa. Kết cấu rất nhẹ, không bóng nhờn khiến đây là lựa chọn được ưa chuộng cho da dầu và da hỗn hợp.',
      ingredients: 'Thành phần: Dầu hạt nho ép cơ học (tên gọi quốc tế theo quy ước INCI: Vitis Vinifera Seed Oil).',
      usage: 'Thoa một lượng nhỏ lên da sau bước làm sạch, phù hợp dùng hằng ngày cho vùng mặt.',
      benefits: [
        { text: 'Kết cấu rất nhẹ, ít gây bít lỗ chân lông', claimType: 'factual' },
        { text: 'Giàu axit linoleic và polyphenol chống oxy hóa', claimType: 'factual' },
        { text: 'Phù hợp cho da dầu và da hỗn hợp', claimType: 'marketing' },
      ],
      warnings: [...BASE_WARNINGS_VI],
    },
    zh: {
      shortDescription: '葡萄籽油质地极为轻盈、致痘性低，富含亚油酸与抗氧化成分。',
      description: '葡萄籽油萃取自葡萄籽——葡萄酒酿造的副产物，天然富含亚油酸及多酚类抗氧化成分。质地极为轻盈、不显油光，深受油性及混合性肌肤喜爱。',
      ingredients: '成分：机榨葡萄籽油（国际化妆品成分命名 INCI：Vitis Vinifera Seed Oil）。',
      usage: '洁面后取适量涂抹于肌肤，适合日常用于面部护理。',
      benefits: [
        { text: '质地极为轻盈，致痘性低', claimType: 'factual' },
        { text: '富含亚油酸与多酚类抗氧化成分', claimType: 'factual' },
        { text: '适合油性及混合性肌肤', claimType: 'marketing' },
      ],
      warnings: [...BASE_WARNINGS_ZH],
    },
  },
  // ---------------------------------------------------------------------
  {
    id: 'natural-oils:flaxseed-oil',
    botanicalName: 'Linum Usitatissimum (Linseed) Seed Oil',
    extractionMethod: 'cold-pressed',
    variant: { sku: 'FS-100', netQuantityValue: '100', netQuantityUnit: 'ml', containerType: 'amber-glass' },
    priceMinor: 250000,
    vi: {
      shortDescription: 'Dầu hạt lanh ép lạnh giàu axit béo omega-3 (ALA), hỗ trợ làn da mềm mại và đàn hồi hơn.',
      description: 'Dầu hạt lanh được ép lạnh từ hạt lanh, giàu axit alpha-linolenic (ALA) — một axit béo omega-3 thực vật. Đây là một lựa chọn được nhiều người quan tâm cho làn da cần thêm độ mềm mại và đàn hồi.',
      ingredients: 'Thành phần: Dầu hạt lanh ép lạnh (tên gọi quốc tế theo quy ước INCI: Linum Usitatissimum Seed Oil).',
      usage: 'Thoa một lượng nhỏ lên da sau khi làm sạch, có thể dùng riêng hoặc pha cùng các loại dầu khác.',
      benefits: [
        { text: 'Giàu axit béo omega-3 (ALA) từ thực vật', claimType: 'factual' },
        { text: 'Hỗ trợ làn da mềm mại, đàn hồi hơn', claimType: 'marketing' },
        { text: 'Phù hợp cho da khô cần dưỡng ẩm', claimType: 'marketing' },
      ],
      warnings: [...BASE_WARNINGS_VI, OXIDATION_NOTE_VI],
    },
    zh: {
      shortDescription: '冷压亚麻籽油富含omega-3脂肪酸（ALA），有助肌肤更加柔软有弹性。',
      description: '亚麻籽油以冷压方式萃取自亚麻籽，天然富含α-亚麻酸（ALA）——一种植物来源的omega-3脂肪酸。是许多希望增加肌肤柔软度与弹性人群的关注之选。',
      ingredients: '成分：冷压亚麻籽油（国际化妆品成分命名 INCI：Linum Usitatissimum Seed Oil）。',
      usage: '洁面后取适量涂抹于肌肤，可单独使用，也可与其他油品调和使用。',
      benefits: [
        { text: '富含植物来源的omega-3脂肪酸（ALA）', claimType: 'factual' },
        { text: '有助肌肤更加柔软有弹性', claimType: 'marketing' },
        { text: '适合需要滋润的干燥肌肤', claimType: 'marketing' },
      ],
      warnings: [...BASE_WARNINGS_ZH, OXIDATION_NOTE_ZH],
    },
  },
  // ---------------------------------------------------------------------
  {
    id: 'natural-oils:hempseed-oil',
    botanicalName: 'Cannabis Sativa Seed Oil',
    extractionMethod: 'cold-pressed',
    variant: { sku: 'HS-100', netQuantityValue: '100', netQuantityUnit: 'ml', containerType: 'amber-glass' },
    priceMinor: 380000,
    vi: {
      shortDescription: 'Dầu hạt gai dầu ép lạnh có kết cấu nhẹ, tỷ lệ omega-3/omega-6 cân bằng — không chứa THC hay CBD.',
      description: 'Dầu hạt gai dầu (hemp seed oil) được ép lạnh từ hạt cây gai dầu, khác biệt với chiết xuất CBD hay hoa gai dầu — dầu hạt hoàn toàn không chứa THC hay CBD. Nổi bật với tỷ lệ cân bằng giữa axit béo omega-3 và omega-6, dầu có kết cấu nhẹ và ít gây bít lỗ chân lông.',
      ingredients: 'Thành phần: Dầu hạt gai dầu ép lạnh (tên gọi quốc tế theo quy ước INCI: Cannabis Sativa Seed Oil).',
      usage: 'Thoa một lượng nhỏ lên da sau bước làm sạch, phù hợp dùng hằng ngày cho vùng mặt.',
      benefits: [
        { text: 'Kết cấu nhẹ, ít gây bít lỗ chân lông', claimType: 'factual' },
        { text: 'Tỷ lệ omega-3/omega-6 cân bằng tự nhiên', claimType: 'factual' },
        { text: 'Hỗ trợ làn da mềm mại, dễ chịu hơn', claimType: 'marketing' },
      ],
      warnings: [...BASE_WARNINGS_VI],
    },
    zh: {
      shortDescription: '冷压大麻籽油质地轻盈，omega-3与omega-6比例均衡——不含THC或CBD成分。',
      description: '大麻籽油（hemp seed oil）冷压萃取自大麻籽，与CBD萃取物或大麻花完全不同——籽油本身不含THC或CBD成分。其omega-3与omega-6脂肪酸比例天然均衡，质地轻盈、致痘性低。',
      ingredients: '成分：冷压大麻籽油（国际化妆品成分命名 INCI：Cannabis Sativa Seed Oil）。',
      usage: '洁面后取适量涂抹于肌肤，适合日常用于面部护理。',
      benefits: [
        { text: '质地轻盈，致痘性低', claimType: 'factual' },
        { text: '天然均衡的omega-3与omega-6比例', claimType: 'factual' },
        { text: '有助肌肤更加柔软舒适', claimType: 'marketing' },
      ],
      warnings: [...BASE_WARNINGS_ZH],
    },
  },
  // ---------------------------------------------------------------------
  {
    id: 'natural-oils:walnut-oil',
    botanicalName: 'Juglans Regia (Walnut) Seed Oil',
    extractionMethod: 'cold-pressed',
    variant: { sku: 'WN-100', netQuantityValue: '100', netQuantityUnit: 'ml', containerType: 'amber-glass' },
    priceMinor: 360000,
    vi: {
      shortDescription: 'Dầu óc chó ép lạnh giàu axit béo omega-3 và vitamin E, thường dùng dưỡng da và tóc.',
      description: 'Dầu óc chó được ép lạnh từ nhân hạt óc chó, giàu axit béo omega-3 và vitamin E tự nhiên. Kết cấu vừa phải, dễ thấm khiến dầu óc chó thường được dùng trong dưỡng da và chăm sóc tóc.',
      ingredients: 'Thành phần: Dầu óc chó ép lạnh (tên gọi quốc tế theo quy ước INCI: Juglans Regia Seed Oil).',
      usage: 'Thoa một lượng nhỏ lên da hoặc tóc, có thể dùng trực tiếp hoặc kết hợp trong quy trình dưỡng hằng ngày.',
      benefits: [
        { text: 'Giàu axit béo omega-3 và vitamin E tự nhiên', claimType: 'factual' },
        { text: 'Hỗ trợ dưỡng tóc và da mềm mại hơn', claimType: 'marketing' },
        { text: 'Kết cấu vừa phải, dễ thấm', claimType: 'marketing' },
      ],
      warnings: [...BASE_WARNINGS_VI, TREE_NUT_ALLERGY_VI],
    },
    zh: {
      shortDescription: '冷压核桃油富含omega-3脂肪酸与维生素E，常用于护肤护发。',
      description: '核桃油冷压萃取自核桃仁，天然富含omega-3脂肪酸与维生素E。质地适中、易于吸收，常被用于护肤及护发保养。',
      ingredients: '成分：冷压核桃油（国际化妆品成分命名 INCI：Juglans Regia Seed Oil）。',
      usage: '取适量涂抹于肌肤或头发，可直接使用，也可融入日常护理步骤。',
      benefits: [
        { text: '天然富含omega-3脂肪酸与维生素E', claimType: 'factual' },
        { text: '有助头发与肌肤更加柔顺柔软', claimType: 'marketing' },
        { text: '质地适中，易于吸收', claimType: 'marketing' },
      ],
      warnings: [...BASE_WARNINGS_ZH, TREE_NUT_ALLERGY_ZH],
    },
  },
  // ---------------------------------------------------------------------
  {
    id: 'natural-oils:macadamia-oil',
    botanicalName: 'Macadamia Ternifolia Seed Oil',
    extractionMethod: 'expeller-pressed',
    variant: { sku: 'MC-100', netQuantityValue: '100', netQuantityUnit: 'ml', containerType: 'amber-glass' },
    priceMinor: 420000,
    vi: {
      shortDescription: 'Dầu hạt mắc ca giàu axit palmitoleic — cấu trúc gần giống dầu tự nhiên trên da, phù hợp cho da khô và da trưởng thành.',
      description: 'Dầu hạt mắc ca được ép từ nhân hạt mắc ca, nổi bật với hàm lượng axit palmitoleic cao — một loại axit béo có cấu trúc gần giống với dầu tự nhiên (sebum) trên da người. Đây là lựa chọn được ưa chuộng cho da khô và da trưởng thành.',
      ingredients: 'Thành phần: Dầu hạt mắc ca (tên gọi quốc tế theo quy ước INCI: Macadamia Ternifolia Seed Oil).',
      usage: 'Thoa một lượng nhỏ lên da sau khi làm sạch, đặc biệt phù hợp dùng vào buổi tối.',
      benefits: [
        { text: 'Giàu axit palmitoleic, cấu trúc gần giống dầu tự nhiên trên da', claimType: 'factual' },
        { text: 'Phù hợp cho da khô và da trưởng thành', claimType: 'marketing' },
        { text: 'Hỗ trợ dưỡng ẩm và làm mềm da', claimType: 'marketing' },
      ],
      warnings: [...BASE_WARNINGS_VI, TREE_NUT_ALLERGY_VI, COMEDOGENIC_NOTE_VI],
    },
    zh: {
      shortDescription: '夏威夷果油富含棕榈油酸——结构与肌肤天然皮脂相近，适合干燥及成熟肌肤。',
      description: '夏威夷果油萃取自夏威夷果仁，以高含量的棕榈油酸著称——这种脂肪酸的结构与人体肌肤天然皮脂（sebum）十分相近。是干燥及成熟肌肤偏爱的选择之一。',
      ingredients: '成分：夏威夷果油（国际化妆品成分命名 INCI：Macadamia Ternifolia Seed Oil）。',
      usage: '洁面后取适量涂抹于肌肤，尤其适合夜间护理使用。',
      benefits: [
        { text: '富含棕榈油酸，结构与肌肤天然皮脂相近', claimType: 'factual' },
        { text: '适合干燥及成熟肌肤', claimType: 'marketing' },
        { text: '有助滋润并柔软肌肤', claimType: 'marketing' },
      ],
      warnings: [...BASE_WARNINGS_ZH, TREE_NUT_ALLERGY_ZH, COMEDOGENIC_NOTE_ZH],
    },
  },
  // ---------------------------------------------------------------------
  // "Mini" 30 ml variants of four flagship oils (see productTranslations'
  // existing name — vi says "nhỏ" i.e. small/travel-size, zh says
  // "奶油"/"milk oil"; those two don't actually agree with each other,
  // which predates this script — see project-status.md for the flag).
  // This content treats them as the small/travel-size reading (matching
  // the vi name, and the only reading that makes them a coherent product
  // distinct from their full-size sibling) — same oil, same properties,
  // smaller bottle.
  // ---------------------------------------------------------------------
  {
    id: 'natural-oils:coconut-milk-oil',
    botanicalName: 'Cocos Nucifera (Coconut) Oil',
    extractionMethod: 'cold-pressed',
    variant: { sku: 'CO-30', netQuantityValue: '30', netQuantityUnit: 'ml', containerType: 'amber-glass' },
    priceMinor: 99000,
    vi: {
      shortDescription: 'Phiên bản dung tích nhỏ 30 ml của Dầu dừa — cùng đặc tính dưỡng ẩm quen thuộc, tiện mang theo khi di chuyển.',
      description: 'Cùng loại dầu dừa nguyên chất với kết cấu đặc, tan chảy nhẹ nhàng khi tiếp xúc với da, được đóng trong chai 30 ml nhỏ gọn — phù hợp mang theo du lịch hoặc dùng thử trước khi chọn chai dung tích lớn.',
      ingredients: 'Thành phần: Dầu dừa (tên gọi quốc tế theo quy ước INCI: Cocos Nucifera Oil).',
      usage: 'Thoa một lượng nhỏ lên da hoặc tóc. Nếu dầu ở dạng đặc do nhiệt độ thấp, có thể làm ấm nhẹ giữa hai lòng bàn tay trước khi sử dụng.',
      benefits: [
        { text: 'Dưỡng ẩm tự nhiên, giúp da mềm mại hơn', claimType: 'marketing' },
        { text: 'Dung tích nhỏ gọn, tiện mang theo', claimType: 'marketing' },
        { text: 'Kết cấu đặc ở nhiệt độ mát, tan chảy khi tiếp xúc với da', claimType: 'factual' },
      ],
      warnings: [...BASE_WARNINGS_VI, COMEDOGENIC_NOTE_VI],
    },
    zh: {
      shortDescription: '椰子油的30毫升小容量版本——同样的滋润特性，方便随身携带。',
      description: '与正装椰子油成分相同，质地浓郁、遇肌肤温度即化，装于30毫升小瓶中，适合旅行携带或在选购正装前先行试用。',
      ingredients: '成分：椰子油（国际化妆品成分命名 INCI：Cocos Nucifera Oil）。',
      usage: '取适量涂抹于肌肤或头发。若因低温呈固态，可先在掌心轻轻搓热后再使用。',
      benefits: [
        { text: '天然滋润，有助肌肤更加柔软', claimType: 'marketing' },
        { text: '容量小巧，便于随身携带', claimType: 'marketing' },
        { text: '低温下呈固态，接触肌肤后自然融化', claimType: 'factual' },
      ],
      warnings: [...BASE_WARNINGS_ZH, COMEDOGENIC_NOTE_ZH],
    },
  },
  // ---------------------------------------------------------------------
  {
    id: 'natural-oils:sesame-milk-oil',
    botanicalName: 'Sesamum Indicum (Sesame) Seed Oil',
    extractionMethod: 'cold-pressed',
    variant: { sku: 'SE-30', netQuantityValue: '30', netQuantityUnit: 'ml', containerType: 'amber-glass' },
    priceMinor: 79000,
    vi: {
      shortDescription: 'Phiên bản dung tích nhỏ 30 ml của Dầu mè — tiện mang theo khi di chuyển hoặc dùng thử.',
      description: 'Cùng loại dầu mè ép lạnh giàu vitamin E và sesamin, được đóng trong chai 30 ml nhỏ gọn — phù hợp mang theo du lịch hoặc dùng thử trước khi chọn chai dung tích lớn.',
      ingredients: 'Thành phần: Dầu mè ép lạnh (tên gọi quốc tế theo quy ước INCI: Sesamum Indicum Seed Oil).',
      usage: 'Làm ấm nhẹ giữa hai lòng bàn tay rồi thoa lên da, massage nhẹ nhàng cho đến khi thấm.',
      benefits: [
        { text: 'Giàu vitamin E và sesamin — chất chống oxy hóa tự nhiên', claimType: 'factual' },
        { text: 'Dung tích nhỏ gọn, tiện mang theo', claimType: 'marketing' },
        { text: 'Kết cấu ấm, phù hợp dùng khi massage', claimType: 'marketing' },
      ],
      warnings: [...BASE_WARNINGS_VI, COMEDOGENIC_NOTE_VI],
    },
    zh: {
      shortDescription: '芝麻油的30毫升小容量版本——方便旅行携带或试用。',
      description: '与正装芝麻油成分相同，冷压萃取、富含维生素E与芝麻素，装于30毫升小瓶中，适合旅行携带或在选购正装前先行试用。',
      ingredients: '成分：冷压芝麻油（国际化妆品成分命名 INCI：Sesamum Indicum Seed Oil）。',
      usage: '取适量于掌心稍稍温热后涂抹于肌肤，轻轻按摩至吸收。',
      benefits: [
        { text: '富含维生素E与芝麻素等天然抗氧化成分', claimType: 'factual' },
        { text: '容量小巧，便于随身携带', claimType: 'marketing' },
        { text: '质地温润，适合按摩护理使用', claimType: 'marketing' },
      ],
      warnings: [...BASE_WARNINGS_ZH, COMEDOGENIC_NOTE_ZH],
    },
  },
  // ---------------------------------------------------------------------
  {
    id: 'natural-oils:olive-milk-oil',
    botanicalName: 'Olea Europaea (Olive) Fruit Oil',
    extractionMethod: 'cold-pressed',
    variant: { sku: 'OL-30', netQuantityValue: '30', netQuantityUnit: 'ml', containerType: 'amber-glass' },
    priceMinor: 99000,
    vi: {
      shortDescription: 'Phiên bản dung tích nhỏ 30 ml của Dầu olive — tiện mang theo khi di chuyển hoặc dùng thử.',
      description: 'Cùng loại dầu olive ép lạnh nguyên chất giàu vitamin E và polyphenol, được đóng trong chai 30 ml nhỏ gọn — phù hợp mang theo du lịch hoặc dùng thử trước khi chọn chai dung tích lớn.',
      ingredients: 'Thành phần: Dầu olive ép lạnh nguyên chất (tên gọi quốc tế theo quy ước INCI: Olea Europaea Fruit Oil).',
      usage: 'Thoa một lượng nhỏ lên da hoặc tóc sau khi làm sạch.',
      benefits: [
        { text: 'Giàu vitamin E và polyphenol chống oxy hóa tự nhiên', claimType: 'factual' },
        { text: 'Dung tích nhỏ gọn, tiện mang theo', claimType: 'marketing' },
        { text: 'Hỗ trợ dưỡng ẩm sâu cho da khô', claimType: 'marketing' },
      ],
      warnings: [...BASE_WARNINGS_VI, COMEDOGENIC_NOTE_VI],
    },
    zh: {
      shortDescription: '橄榄油的30毫升小容量版本——方便旅行携带或试用。',
      description: '与正装橄榄油成分相同，冷压初榨、富含维生素E与多酚类抗氧化成分，装于30毫升小瓶中，适合旅行携带或在选购正装前先行试用。',
      ingredients: '成分：冷压初榨橄榄油（国际化妆品成分命名 INCI：Olea Europaea Fruit Oil）。',
      usage: '洁面后取适量涂抹于肌肤或头发。',
      benefits: [
        { text: '天然富含维生素E与多酚类抗氧化成分', claimType: 'factual' },
        { text: '容量小巧，便于随身携带', claimType: 'marketing' },
        { text: '有助深层滋润干燥肌肤', claimType: 'marketing' },
      ],
      warnings: [...BASE_WARNINGS_ZH, COMEDOGENIC_NOTE_ZH],
    },
  },
  // ---------------------------------------------------------------------
  {
    id: 'natural-oils:avocado-milk-oil',
    botanicalName: 'Persea Gratissima (Avocado) Oil',
    extractionMethod: 'cold-pressed',
    variant: { sku: 'AV-30', netQuantityValue: '30', netQuantityUnit: 'ml', containerType: 'amber-glass' },
    priceMinor: 119000,
    vi: {
      shortDescription: 'Phiên bản dung tích nhỏ 30 ml của Dầu bơ (avocado) — tiện mang theo khi di chuyển hoặc dùng thử.',
      description: 'Cùng loại dầu bơ ép lạnh giàu vitamin E và axit oleic, được đóng trong chai 30 ml nhỏ gọn — phù hợp mang theo du lịch hoặc dùng thử trước khi chọn chai dung tích lớn.',
      ingredients: 'Thành phần: Dầu bơ ép lạnh (tên gọi quốc tế theo quy ước INCI: Persea Gratissima Oil).',
      usage: 'Thoa một lượng nhỏ lên vùng da khô sau khi làm sạch.',
      benefits: [
        { text: 'Giàu vitamin E và axit oleic tự nhiên', claimType: 'factual' },
        { text: 'Dung tích nhỏ gọn, tiện mang theo', claimType: 'marketing' },
        { text: 'Hỗ trợ dưỡng ẩm chuyên sâu cho da khô', claimType: 'marketing' },
      ],
      warnings: [...BASE_WARNINGS_VI, COMEDOGENIC_NOTE_VI],
    },
    zh: {
      shortDescription: '牛油果油的30毫升小容量版本——方便旅行携带或试用。',
      description: '与正装牛油果油成分相同，冷压萃取、富含维生素E与油酸，装于30毫升小瓶中，适合旅行携带或在选购正装前先行试用。',
      ingredients: '成分：冷压牛油果油（国际化妆品成分命名 INCI：Persea Gratissima Oil）。',
      usage: '洁面后取适量涂抹于干燥部位。',
      benefits: [
        { text: '天然富含维生素E与油酸', claimType: 'factual' },
        { text: '容量小巧，便于随身携带', claimType: 'marketing' },
        { text: '有助深层滋润干燥肌肤', claimType: 'marketing' },
      ],
      warnings: [...BASE_WARNINGS_ZH, COMEDOGENIC_NOTE_ZH],
    },
  },
];

async function main() {
  console.log(`Populating verified/researched content for ${PRODUCTS.length} Natural Oils products (VI + ZH)...`);

  for (const p of PRODUCTS) {
    console.log(`\n${p.id}`);
    const variantId = `${p.id}:${p.variant.sku.split('-').pop()}ml`;
    const priceId = `${variantId}:price:vnd`;

    await db
      .update(products)
      .set({
        botanicalName: p.botanicalName,
        countryOfOriginCode: COUNTRY,
        extractionMethod: p.extractionMethod,
        manufacturerName: MANUFACTURER,
        updatedAt: new Date(),
      })
      .where(eq(products.id, p.id));

    await db
      .insert(productVariants)
      .values({
        id: variantId,
        productId: p.id,
        sku: p.variant.sku,
        isDefault: true,
        sortOrder: 0,
        netQuantityValue: p.variant.netQuantityValue,
        netQuantityUnit: p.variant.netQuantityUnit,
        containerType: p.variant.containerType,
      })
      .onConflictDoUpdate({
        target: productVariants.id,
        set: {
          sku: p.variant.sku,
          isDefault: true,
          sortOrder: 0,
          netQuantityValue: p.variant.netQuantityValue,
          netQuantityUnit: p.variant.netQuantityUnit,
          containerType: p.variant.containerType,
          gtin: null,
        },
      });

    for (const locale of ['vi', 'zh'] as const) {
      await db
        .insert(productVariantTranslations)
        .values({ variantId, locale, label: `${p.variant.netQuantityValue} ml` })
        .onConflictDoUpdate({
          target: [productVariantTranslations.variantId, productVariantTranslations.locale],
          set: { label: `${p.variant.netQuantityValue} ml` },
        });
    }

    await db
      .insert(pricing)
      .values({ id: priceId, variantId, priceMinor: p.priceMinor, compareAtMinor: null, currency: 'VND' })
      .onConflictDoUpdate({
        target: pricing.id,
        set: { priceMinor: p.priceMinor, compareAtMinor: null, currency: 'VND', effectiveTo: null },
      });

    for (const locale of ['vi', 'zh'] as const) {
      const c = p[locale];

      // The row already exists (seed-natural-oils.ts inserted id/slug/name
      // for all 19 products) — this only fills in the description/
      // ingredients/usage columns that script deliberately left NULL, and
      // never touches `name` (already correct, not part of this script's
      // provenance categories at all).
      await db
        .update(productTranslations)
        .set({
          shortDescription: c.shortDescription,
          description: c.description,
          ingredients: c.ingredients,
          usageInstructions: c.usage,
        })
        .where(and(eq(productTranslations.productId, p.id), eq(productTranslations.locale, locale)));

      for (const [index, benefit] of c.benefits.entries()) {
        await db
          .insert(productBenefits)
          .values({
            id: `${p.id}:benefit:${locale}:${index}`,
            productId: p.id,
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
          .values({ id: `${p.id}:warning:${locale}:${index}`, productId: p.id, locale, sortOrder: index, text: warning })
          .onConflictDoUpdate({
            target: productWarnings.id,
            set: { text: warning, sortOrder: index },
          });
      }

      console.log(`  ${locale}: short_description, description, ingredients, usage, ${c.benefits.length} benefits, ${c.warnings.length} warnings`);
    }
  }

  console.log(
    `\nDone. Added botanical name, origin, extraction method, manufacturer, one default variant, ` +
    `and VND pricing for ${PRODUCTS.length} products. Certifications and real photography remain untouched/NULL.`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('Natural Oils content seed failed:', err);
  process.exit(1);
});
