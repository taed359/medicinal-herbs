/**
 * Maps each product to its "oil family" abstract icon (see the SVG files
 * under public/images/products/oils/) -- NOT real product photography.
 *
 * Every SVG in that folder is the same abstract bottle silhouette used by
 * src/assets/images/products/natural-oils/placeholder-bottle.svg (no
 * label, no logo, brand colors only) with one added, distinct abstract
 * botanical motif per oil family, so listing pages and the PDP gallery
 * can tell products apart visually before real photography exists.
 *
 * `seed-product-icons.ts` seeds these as real `product_images` rows --
 * a deliberate, narrow exception to the "don't create fake image rows
 * pointing at shared placeholder bytes" rule documented in
 * product-image-fallback.ts (which itself exists because an earlier
 * placeholder was a photo of a competitor's branded bottle). This is
 * safe because every family gets its own distinct, still-abstract,
 * still-unbranded asset -- no product is ever shown next to another
 * brand's real photography, and no two *different* oils share the exact
 * same image.
 *
 * "Milk-oil" mini-size retail products and every Wholesale bulk product
 * reuse their full-size Natural Oils sibling's icon -- same underlying
 * oil substance, same pattern already used for carrying over
 * botanicalName/extractionMethod to those products (see
 * seed-natural-oils-content.ts / seed-wholesale-products.ts).
 */

export type OilFamily =
  | 'coconut'
  | 'rice-bran'
  | 'peanut'
  | 'sunflower'
  | 'soybean'
  | 'canola'
  | 'palm'
  | 'sesame'
  | 'olive'
  | 'avocado'
  | 'grapeseed'
  | 'flaxseed'
  | 'hempseed'
  | 'walnut'
  | 'macadamia';

// Plain-language oil name per locale, used only to build an honest,
// non-fabricated alt string ("illustration of X oil") for the seeded
// image row -- never worded as if it were a real photo.
export const OIL_FAMILY_LABEL: Record<OilFamily, { vi: string; zh: string }> = {
  coconut: { vi: 'dầu dừa', zh: '椰子油' },
  'rice-bran': { vi: 'dầu cám gạo', zh: '米糠油' },
  peanut: { vi: 'dầu đậu phộng', zh: '花生油' },
  sunflower: { vi: 'dầu hướng dương', zh: '葵花籽油' },
  soybean: { vi: 'dầu đậu nành', zh: '大豆油' },
  canola: { vi: 'dầu cải', zh: '菜籽油' },
  palm: { vi: 'dầu cọ', zh: '棕榈油' },
  sesame: { vi: 'dầu mè', zh: '芝麻油' },
  olive: { vi: 'dầu olive', zh: '橄榄油' },
  avocado: { vi: 'dầu bơ / avocado', zh: '牛油果油' },
  grapeseed: { vi: 'dầu hạt nho', zh: '葡萄籽油' },
  flaxseed: { vi: 'dầu hạt lanh', zh: '亚麻籽油' },
  hempseed: { vi: 'dầu hạt gai dầu', zh: '大麻籽油' },
  walnut: { vi: 'dầu óc chó', zh: '核桃油' },
  macadamia: { vi: 'dầu hạt mắc ca', zh: '澳洲坚果油' },
};

export const PRODUCT_OIL_FAMILY: Record<string, OilFamily> = {
  // Natural Oils (retail) -- 19 products
  'natural-oils:coconut-oil': 'coconut',
  'natural-oils:rice-bran-oil': 'rice-bran',
  'natural-oils:peanut-oil': 'peanut',
  'natural-oils:sunflower-oil': 'sunflower',
  'natural-oils:soybean-oil': 'soybean',
  'natural-oils:canola-oil': 'canola',
  'natural-oils:palm-oil': 'palm',
  'natural-oils:sesame-oil': 'sesame',
  'natural-oils:olive-oil': 'olive',
  'natural-oils:avocado-oil': 'avocado',
  'natural-oils:grapeseed-oil': 'grapeseed',
  'natural-oils:flaxseed-oil': 'flaxseed',
  'natural-oils:hempseed-oil': 'hempseed',
  'natural-oils:walnut-oil': 'walnut',
  'natural-oils:macadamia-oil': 'macadamia',
  'natural-oils:coconut-milk-oil': 'coconut',
  'natural-oils:sesame-milk-oil': 'sesame',
  'natural-oils:olive-milk-oil': 'olive',
  'natural-oils:avocado-milk-oil': 'avocado',
  // Wholesale (bulk) -- 15 products, same oils as their retail siblings
  'wholesale:coconut-oil-bulk': 'coconut',
  'wholesale:sunflower-oil-bulk': 'sunflower',
  'wholesale:soybean-oil-bulk': 'soybean',
  'wholesale:canola-oil-bulk': 'canola',
  'wholesale:palm-oil-bulk': 'palm',
  'wholesale:peanut-oil-bulk': 'peanut',
  'wholesale:rice-bran-oil-bulk': 'rice-bran',
  'wholesale:sesame-oil-bulk': 'sesame',
  'wholesale:olive-oil-bulk': 'olive',
  'wholesale:avocado-oil-bulk': 'avocado',
  'wholesale:grapeseed-oil-bulk': 'grapeseed',
  'wholesale:flaxseed-oil-bulk': 'flaxseed',
  'wholesale:hempseed-oil-bulk': 'hempseed',
  'wholesale:walnut-oil-bulk': 'walnut',
  'wholesale:macadamia-oil-bulk': 'macadamia',
};

export function oilFamilyIconUrl(family: OilFamily): string {
  return `/images/products/oils/${family}.svg`;
}

// Every icon shares this viewBox/intrinsic size (see gen script) --
// product_images.width/height are NOT NULL columns, so this is what gets
// stored alongside each seeded row.
export const OIL_ICON_SIZE = 960;
