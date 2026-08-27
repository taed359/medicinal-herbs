/**
 * Canonical, locale-RESOLVED read models handed from the repository layer
 * to Astro pages. "Resolved" means: the caller already picked a locale
 * (see repository method signatures), so these types carry plain strings
 * (`name: string`), never `Record<Locale, string>` — components never
 * choose a locale themselves, they just render whatever string they're
 * given. This mirrors src/i18n/utils.ts's `Locale` union deliberately, so
 * page code can pass the same `lang` value through both systems.
 */
export type Locale = 'vi' | 'zh';

export interface LocalizedImage {
  id: string;
  url: string;
  alt: string;
  width: number;
  height: number;
  role: 'primary' | 'gallery' | 'thumbnail';
  sortOrder: number;
}

export interface ProductVariantView {
  id: string;
  sku: string;
  label: string;
  isDefault: boolean;
  priceMinor: number | null;
  compareAtMinor: number | null;
  currency: string | null;
  inventoryQuantity: number | null;
  // --- Natural Oil packaging/identity additions (nullable; unseeded —
  // see natural-oil-product-attribute-audit.md §2.H) ---
  netQuantityValue: number | null;
  netQuantityUnit: 'ml' | 'l' | 'g' | 'fl_oz' | null;
  containerType: string | null;
  gtin: string | null;
}

/**
 * A single translated marketing/content bullet, tagged with the kind of
 * claim it makes — see natural-oil-product-attribute-audit.md §1.2/§N.
 * 'structure_function' is a real, valid value; nothing in this codebase
 * currently produces one (no seed data assigns it).
 */
export interface ProductBenefitView {
  text: string;
  claimType: 'factual' | 'marketing' | 'structure_function';
}

export interface ProductCertificationView {
  certType: string; // controlled vocabulary; UI/i18n resolves the display label
  issuingBody: string | null;
  certificateNumber: string | null;
  validFrom: string | null; // ISO date (YYYY-MM-DD)
  validTo: string | null;
}

export interface CategoryView {
  id: string;
  slug: string;
  locale: Locale;
  name: string;
  description: string | null;
}

/** Full detail view for a single product detail page (PDP). */
export interface ProductDetailView {
  id: string;
  slug: string;
  categoryId: string;
  locale: Locale;
  name: string;
  shortDescription: string | null;
  description: string | null;
  ingredients: string | null;
  usage: string | null;
  benefits: ProductBenefitView[];
  images: LocalizedImage[];
  variants: ProductVariantView[];
  isFeatured: boolean;
  isPublished: boolean;
  // --- Natural Oil attribute additions (nullable/empty; unseeded — see
  // natural-oil-product-attribute-audit.md §2.F/§2.G) ---
  botanicalName: string | null;
  countryOfOriginCode: string | null;
  extractionMethod: string | null;
  manufacturerName: string | null;
  warnings: string[];
  certifications: ProductCertificationView[];
}

/**
 * Lighter read model for grid/carousel views (listing pages, homepage
 * featured rail) — deliberately excludes description/benefits/full variant
 * list so a page rendering 10-40 cards doesn't pull content it won't render.
 */
export interface ProductSummaryView {
  id: string;
  slug: string;
  categoryId: string;
  locale: Locale;
  name: string;
  isFeatured: boolean;
  primaryImage: LocalizedImage | null;
  priceMinor: number | null;
  compareAtMinor: number | null;
  currency: string | null;
}
