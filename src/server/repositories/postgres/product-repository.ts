import { and, asc, desc, eq, gt, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  products,
  productTranslations,
  productBenefits,
  productWarnings,
  productCertifications,
  productImages,
  productImageTranslations,
  productVariants,
  productVariantTranslations,
  pricing,
  inventory,
} from '../../../db/schema';
import type {
  Locale,
  LocalizedImage,
  ProductBenefitView,
  ProductCertificationView,
  ProductDetailView,
  ProductSummaryView,
  ProductVariantView,
} from '../../../domain/types';
import type { ProductRepository } from '../types';

function toLocalizedImage(row: {
  id: string;
  url: string;
  alt: string | null;
  width: number;
  height: number;
  role: string;
  sortOrder: number;
}): LocalizedImage {
  return {
    id: row.id,
    url: row.url,
    alt: row.alt ?? '',
    width: row.width,
    height: row.height,
    role: row.role as LocalizedImage['role'],
    sortOrder: row.sortOrder,
  };
}

/** Fetch the primary image for a set of product ids in one query, keyed by product id. */
async function fetchPrimaryImages(productIds: string[], locale: Locale): Promise<Map<string, LocalizedImage>> {
  if (productIds.length === 0) return new Map();

  const rows = await db
    .select({
      productId: productImages.productId,
      id: productImages.id,
      url: productImages.url,
      width: productImages.width,
      height: productImages.height,
      role: productImages.role,
      sortOrder: productImages.sortOrder,
      alt: productImageTranslations.alt,
    })
    .from(productImages)
    .leftJoin(
      productImageTranslations,
      and(eq(productImageTranslations.imageId, productImages.id), eq(productImageTranslations.locale, locale))
    )
    .where(and(inArray(productImages.productId, productIds), eq(productImages.role, 'primary')));

  const map = new Map<string, LocalizedImage>();
  for (const row of rows) {
    map.set(row.productId, toLocalizedImage(row));
  }
  return map;
}

/** "Current" price for a set of variant ids: latest pricing row whose
 * effective window includes now(). Keyed by variant id. */
async function fetchCurrentPricing(variantIds: string[]): Promise<Map<string, { priceMinor: number; compareAtMinor: number | null; currency: string }>> {
  if (variantIds.length === 0) return new Map();

  const now = sql`now()`;
  const rows = await db
    .select({
      variantId: pricing.variantId,
      priceMinor: pricing.priceMinor,
      compareAtMinor: pricing.compareAtMinor,
      currency: pricing.currency,
      effectiveFrom: pricing.effectiveFrom,
    })
    .from(pricing)
    .where(
      and(
        inArray(pricing.variantId, variantIds),
        lte(pricing.effectiveFrom, now),
        or(isNull(pricing.effectiveTo), gt(pricing.effectiveTo, now))
      )
    )
    .orderBy(desc(pricing.effectiveFrom));

  const map = new Map<string, { priceMinor: number; compareAtMinor: number | null; currency: string }>();
  for (const row of rows) {
    // rows are ordered latest-first; keep only the first (most recent) per variant
    if (!map.has(row.variantId)) {
      map.set(row.variantId, {
        priceMinor: row.priceMinor,
        compareAtMinor: row.compareAtMinor,
        currency: row.currency,
      });
    }
  }
  return map;
}

class PostgresProductRepository implements ProductRepository {
  async getBySlug(slug: string, locale: Locale): Promise<ProductDetailView | null> {
    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.slug, slug), eq(products.isPublished, true)))
      .limit(1);

    if (!product) return null;

    const [translation] = await db
      .select()
      .from(productTranslations)
      .where(and(eq(productTranslations.productId, product.id), eq(productTranslations.locale, locale)))
      .limit(1);

    // No translation for the requested locale on a published product is a
    // data-integrity problem, not a rendering decision — fail loudly at
    // build time rather than silently showing the wrong language.
    if (!translation) return null;

    const benefitRows = await db
      .select({ text: productBenefits.text, claimType: productBenefits.claimType })
      .from(productBenefits)
      .where(and(eq(productBenefits.productId, product.id), eq(productBenefits.locale, locale)))
      .orderBy(asc(productBenefits.sortOrder));

    const warningRows = await db
      .select({ text: productWarnings.text })
      .from(productWarnings)
      .where(and(eq(productWarnings.productId, product.id), eq(productWarnings.locale, locale)))
      .orderBy(asc(productWarnings.sortOrder));

    // Certifications carry no locale column (see schema.ts) — cert_type's
    // display label is resolved in the UI/i18n layer, not per-row here.
    const certificationRows = await db
      .select({
        certType: productCertifications.certType,
        issuingBody: productCertifications.issuingBody,
        certificateNumber: productCertifications.certificateNumber,
        validFrom: productCertifications.validFrom,
        validTo: productCertifications.validTo,
      })
      .from(productCertifications)
      .where(eq(productCertifications.productId, product.id));

    const imageRows = await db
      .select({
        id: productImages.id,
        url: productImages.url,
        width: productImages.width,
        height: productImages.height,
        role: productImages.role,
        sortOrder: productImages.sortOrder,
        alt: productImageTranslations.alt,
      })
      .from(productImages)
      .leftJoin(
        productImageTranslations,
        and(eq(productImageTranslations.imageId, productImages.id), eq(productImageTranslations.locale, locale))
      )
      .where(eq(productImages.productId, product.id))
      .orderBy(asc(productImages.sortOrder));

    const variantRows = await db
      .select({
        id: productVariants.id,
        sku: productVariants.sku,
        isDefault: productVariants.isDefault,
        label: productVariantTranslations.label,
        inventoryQuantity: inventory.quantity,
        netQuantityValue: productVariants.netQuantityValue,
        netQuantityUnit: productVariants.netQuantityUnit,
        containerType: productVariants.containerType,
        gtin: productVariants.gtin,
      })
      .from(productVariants)
      .leftJoin(
        productVariantTranslations,
        and(eq(productVariantTranslations.variantId, productVariants.id), eq(productVariantTranslations.locale, locale))
      )
      .leftJoin(inventory, eq(inventory.variantId, productVariants.id))
      .where(eq(productVariants.productId, product.id))
      .orderBy(asc(productVariants.sortOrder));

    const priceMap = await fetchCurrentPricing(variantRows.map((v) => v.id));

    const variants: ProductVariantView[] = variantRows.map((v) => {
      const price = priceMap.get(v.id);
      return {
        id: v.id,
        sku: v.sku,
        label: v.label ?? '',
        isDefault: v.isDefault,
        priceMinor: price?.priceMinor ?? null,
        compareAtMinor: price?.compareAtMinor ?? null,
        currency: price?.currency ?? null,
        inventoryQuantity: v.inventoryQuantity ?? null,
        netQuantityValue: v.netQuantityValue != null ? Number(v.netQuantityValue) : null,
        netQuantityUnit: (v.netQuantityUnit as ProductVariantView['netQuantityUnit']) ?? null,
        containerType: v.containerType ?? null,
        gtin: v.gtin ?? null,
      };
    });

    const benefits: ProductBenefitView[] = benefitRows.map((b) => ({
      text: b.text,
      claimType: b.claimType as ProductBenefitView['claimType'],
    }));

    const certifications: ProductCertificationView[] = certificationRows.map((c) => ({
      certType: c.certType,
      issuingBody: c.issuingBody ?? null,
      certificateNumber: c.certificateNumber ?? null,
      validFrom: c.validFrom ?? null,
      validTo: c.validTo ?? null,
    }));

    return {
      id: product.id,
      slug: product.slug,
      categoryId: product.categoryId,
      locale,
      name: translation.name,
      shortDescription: translation.shortDescription,
      description: translation.description,
      ingredients: translation.ingredients,
      usage: translation.usageInstructions,
      benefits,
      images: imageRows.map(toLocalizedImage),
      variants,
      isFeatured: product.isFeatured,
      isPublished: product.isPublished,
      botanicalName: product.botanicalName ?? null,
      countryOfOriginCode: product.countryOfOriginCode ?? null,
      extractionMethod: product.extractionMethod ?? null,
      manufacturerName: product.manufacturerName ?? null,
      warnings: warningRows.map((w) => w.text),
      certifications,
    };
  }

  async listByCategory(categoryId: string, locale: Locale): Promise<ProductSummaryView[]> {
    return this.listSummaries(
      and(eq(products.categoryId, categoryId), eq(products.isPublished, true)),
      locale
    );
  }

  async listFeatured(limit: number, locale: Locale): Promise<ProductSummaryView[]> {
    const rows = await this.listSummaries(
      and(eq(products.isFeatured, true), eq(products.isPublished, true)),
      locale
    );
    return rows.slice(0, limit);
  }

  async listAllSlugs(): Promise<string[]> {
    const rows = await db
      .select({ slug: products.slug })
      .from(products)
      .where(eq(products.isPublished, true));
    return rows.map((r) => r.slug);
  }

  private async listSummaries(whereClause: ReturnType<typeof and>, locale: Locale): Promise<ProductSummaryView[]> {
    const rows = await db
      .select({
        id: products.id,
        slug: products.slug,
        categoryId: products.categoryId,
        isFeatured: products.isFeatured,
        sortOrder: products.sortOrder,
        name: productTranslations.name,
      })
      .from(products)
      .innerJoin(
        productTranslations,
        and(eq(productTranslations.productId, products.id), eq(productTranslations.locale, locale))
      )
      .where(whereClause)
      .orderBy(asc(products.sortOrder));

    const productIds = rows.map((r) => r.id);
    const imageMap = await fetchPrimaryImages(productIds, locale);

    // Default-variant current price, per product, in one extra pass.
    const defaultVariantRows = productIds.length
      ? await db
          .select({ productId: productVariants.productId, id: productVariants.id })
          .from(productVariants)
          .where(and(inArray(productVariants.productId, productIds), eq(productVariants.isDefault, true)))
      : [];
    const priceMap = await fetchCurrentPricing(defaultVariantRows.map((v) => v.id));
    const variantIdByProduct = new Map(defaultVariantRows.map((v) => [v.productId, v.id]));

    return rows.map((row) => {
      const variantId = variantIdByProduct.get(row.id);
      const price = variantId ? priceMap.get(variantId) : undefined;
      return {
        id: row.id,
        slug: row.slug,
        categoryId: row.categoryId,
        locale,
        name: row.name,
        isFeatured: row.isFeatured,
        primaryImage: imageMap.get(row.id) ?? null,
        priceMinor: price?.priceMinor ?? null,
        compareAtMinor: price?.compareAtMinor ?? null,
        currency: price?.currency ?? null,
      };
    });
  }
}

export const productRepository: ProductRepository = new PostgresProductRepository();
