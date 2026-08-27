import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, gt, ilike, inArray, isNull, lte, ne, not, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../../../db/client';
import {
  categories,
  categoryTranslations,
  products,
  productTranslations,
  productImages,
  productImageTranslations,
  productVariants,
  productVariantTranslations,
  productBenefits,
  productWarnings,
  productCertifications,
  pricing,
  inventory,
} from '../../../../db/schema';
import type {
  AdminCategoryOption,
  AdminInventorySummary,
  AdminProductBenefitInput,
  AdminProductBenefitSummary,
  AdminProductCertificationInput,
  AdminProductCertificationSummary,
  AdminProductEditView,
  AdminProductGalleryImageInput,
  AdminProductImageSummary,
  AdminProductListItem,
  AdminProductListParams,
  AdminProductListResult,
  AdminProductVariantInput,
  AdminProductVariantSummary,
  AdminProductWarningInput,
  AdminProductWarningSummary,
  AdminProductWriteInput,
} from '../../../../domain/admin-types';
import type { AdminProductRepository } from '../types';
import { probeImageDimensions } from '../../../lib/probe-image';

// Aliased so a single query can join product_translations/
// category_translations twice -- once per locale -- instead of running
// two round trips or stitching rows together in JS.
const viTranslations = alias(productTranslations, 'vi_translations');
const zhTranslations = alias(productTranslations, 'zh_translations');
const viCategoryTranslations = alias(categoryTranslations, 'vi_category_translations');

// Closed allow-list mapping every grid-sortable column name to a real,
// known-safe SQL expression -- a raw column name from the URL's `sort`
// query param is NEVER accepted; parseAdminProductListParams (the page)
// only ever produces one of these three keys, and this map is the single
// place that turns a key into an actual ORDER BY target.
const SORTABLE_COLUMNS = {
  name: viTranslations.name,
  updatedAt: products.updatedAt,
  sortOrder: products.sortOrder,
} as const;

/** "Current" price for a set of variant ids -- same effective-window
 *  logic as the storefront's fetchCurrentPricing (see
 *  src/server/repositories/postgres/product-repository.ts): latest
 *  pricing row whose window includes now(), never an expired one. */
async function fetchCurrentPricingForVariants(
  variantIds: string[]
): Promise<Map<string, { priceMinor: number; compareAtMinor: number | null; currency: string }>> {
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
    if (!map.has(row.variantId)) {
      map.set(row.variantId, { priceMinor: row.priceMinor, compareAtMinor: row.compareAtMinor, currency: row.currency });
    }
  }
  return map;
}

/** Inventory quantity for a set of variant ids, batched in one query. */
async function fetchInventoryForVariants(variantIds: string[]): Promise<Map<string, number | null>> {
  if (variantIds.length === 0) return new Map();

  const rows = await db
    .select({ variantId: inventory.variantId, quantity: inventory.quantity })
    .from(inventory)
    .where(inArray(inventory.variantId, variantIds));

  return new Map(rows.map((r) => [r.variantId, r.quantity]));
}

/** VI-primary / ZH-fallback / slug-fallback display name -- the admin
 *  grid's one deterministic display locale (see the domain type's doc
 *  comment). No admin-language-preference system is introduced here. */
function resolveDisplayName(nameVi: string | null, nameZh: string | null, slug: string): string {
  if (nameVi) return nameVi;
  if (nameZh) return nameZh;
  return slug;
}

/** Builds the two product_translations rows (vi + zh) shared by create()
 *  and update() -- kept in one place so both stay in sync. */
function translationRows(productId: string, input: AdminProductWriteInput) {
  return [
    {
      productId,
      locale: 'vi' as const,
      name: input.nameVi,
      shortDescription: input.shortDescriptionVi,
      description: input.descriptionVi,
      ingredients: input.ingredientsVi,
      usageInstructions: input.usageVi,
    },
    {
      productId,
      locale: 'zh' as const,
      name: input.nameZh,
      shortDescription: input.shortDescriptionZh,
      description: input.descriptionZh,
      ingredients: input.ingredientsZh,
      usageInstructions: input.usageZh,
    },
  ];
}

class PostgresAdminProductRepository implements AdminProductRepository {
  async listCategories(): Promise<AdminCategoryOption[]> {
    const rows = await db
      .select({ id: categories.id, slug: categories.slug, name: categoryTranslations.name })
      .from(categories)
      .innerJoin(
        categoryTranslations,
        and(eq(categoryTranslations.categoryId, categories.id), eq(categoryTranslations.locale, 'vi'))
      )
      .orderBy(asc(categories.sortOrder));
    return rows;
  }

  async getInventorySummary(): Promise<AdminInventorySummary> {
    const [row] = await db
      .select({
        tracked: sql<number>`count(*) filter (where ${inventory.quantity} is not null and ${inventory.lowStockThreshold} is not null)::int`,
        lowStock: sql<number>`count(*) filter (where ${inventory.quantity} is not null and ${inventory.lowStockThreshold} is not null and ${inventory.quantity} <= ${inventory.lowStockThreshold})::int`,
      })
      .from(inventory);
    return { hasTrackedVariants: (row?.tracked ?? 0) > 0, lowStockCount: row?.lowStock ?? 0 };
  }

  async list(params: AdminProductListParams): Promise<AdminProductListResult> {
    const page = Math.max(1, Math.trunc(params.page));
    const pageSize = Math.max(1, Math.trunc(params.pageSize));

    const conditions: SQL[] = [];

    const search = params.search.trim();
    if (search) {
      const pattern = `%${search}%`;
      // Two literal args are always passed, so or() is guaranteed to
      // return a real SQL expression here, never undefined.
      conditions.push(or(ilike(viTranslations.name, pattern), ilike(zhTranslations.name, pattern))!);
    }
    if (params.categoryId) {
      conditions.push(eq(products.categoryId, params.categoryId));
    }
    if (params.status === 'published') {
      conditions.push(eq(products.isPublished, true));
    } else if (params.status === 'draft') {
      conditions.push(eq(products.isPublished, false));
    }
    if (params.featured === 'featured') {
      conditions.push(eq(products.isFeatured, true));
    } else if (params.featured === 'not-featured') {
      conditions.push(eq(products.isFeatured, false));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ value: total }] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(products)
      .innerJoin(viTranslations, and(eq(viTranslations.productId, products.id), eq(viTranslations.locale, 'vi')))
      .leftJoin(zhTranslations, and(eq(zhTranslations.productId, products.id), eq(zhTranslations.locale, 'zh')))
      .where(whereClause);

    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    const sortColumn = SORTABLE_COLUMNS[params.sort];
    const orderBy = params.direction === 'asc' ? asc(sortColumn) : desc(sortColumn);

    // Explicit column selection (not a bare .select()) so every field's
    // origin table is unambiguous -- this file's established style, and
    // it sidesteps ever having to reason about Drizzle's nested-row
    // key-naming for joined/aliased tables.
    const rows = await db
      .select({
        id: products.id,
        slug: products.slug,
        categoryId: products.categoryId,
        categoryName: viCategoryTranslations.name,
        isFeatured: products.isFeatured,
        isPublished: products.isPublished,
        sortOrder: products.sortOrder,
        updatedAt: products.updatedAt,
        nameVi: viTranslations.name,
        nameZh: zhTranslations.name,
        variantId: productVariants.id,
        sku: productVariants.sku,
        imageUrl: productImages.url,
        imageAlt: productImageTranslations.alt,
      })
      .from(products)
      .innerJoin(viTranslations, and(eq(viTranslations.productId, products.id), eq(viTranslations.locale, 'vi')))
      .leftJoin(zhTranslations, and(eq(zhTranslations.productId, products.id), eq(zhTranslations.locale, 'zh')))
      .leftJoin(
        viCategoryTranslations,
        and(eq(viCategoryTranslations.categoryId, products.categoryId), eq(viCategoryTranslations.locale, 'vi'))
      )
      .leftJoin(
        productImages,
        and(eq(productImages.productId, products.id), eq(productImages.role, 'primary'))
      )
      .leftJoin(
        productImageTranslations,
        and(eq(productImageTranslations.imageId, productImages.id), eq(productImageTranslations.locale, 'vi'))
      )
      .leftJoin(
        productVariants,
        and(eq(productVariants.productId, products.id), eq(productVariants.isDefault, true))
      )
      .where(whereClause)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    // Batched price/inventory lookup for just this page's default-variant
    // ids -- total query count stays constant regardless of how many rows
    // are on the page (no N+1), matching the storefront repository's
    // established fetchCurrentPricing/fetchPrimaryImages pattern.
    const variantIds = rows.map((row) => row.variantId).filter((id): id is string => id != null);
    const [priceMap, inventoryMap] = await Promise.all([
      fetchCurrentPricingForVariants(variantIds),
      fetchInventoryForVariants(variantIds),
    ]);

    const items: AdminProductListItem[] = rows.map((row) => {
      const price = row.variantId ? priceMap.get(row.variantId) : undefined;
      const nameZh = row.nameZh ?? null;
      return {
        id: row.id,
        slug: row.slug,
        categoryId: row.categoryId,
        categoryName: row.categoryName ?? row.categoryId,
        nameVi: row.nameVi,
        nameZh: nameZh ?? '',
        displayName: resolveDisplayName(row.nameVi, nameZh, row.slug),
        sku: row.sku ?? null,
        priceMinor: price?.priceMinor ?? null,
        currency: price?.currency ?? null,
        inventoryQuantity: row.variantId ? (inventoryMap.get(row.variantId) ?? null) : null,
        imageUrl: row.imageUrl ?? null,
        imageAlt: row.imageAlt ?? null,
        isFeatured: row.isFeatured,
        isPublished: row.isPublished,
        sortOrder: row.sortOrder,
        updatedAt: row.updatedAt.toISOString(),
      };
    });

    return { items, total, page, pageSize, totalPages };
  }

  async getById(id: string): Promise<AdminProductEditView | null> {
    const [row] = await db
      .select({
        id: products.id,
        slug: products.slug,
        categoryId: products.categoryId,
        isFeatured: products.isFeatured,
        isPublished: products.isPublished,
        sortOrder: products.sortOrder,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
        botanicalName: products.botanicalName,
        countryOfOriginCode: products.countryOfOriginCode,
        extractionMethod: products.extractionMethod,
        manufacturerName: products.manufacturerName,
        nameVi: viTranslations.name,
        nameZh: zhTranslations.name,
        shortDescriptionVi: viTranslations.shortDescription,
        shortDescriptionZh: zhTranslations.shortDescription,
        descriptionVi: viTranslations.description,
        descriptionZh: zhTranslations.description,
        ingredientsVi: viTranslations.ingredients,
        ingredientsZh: zhTranslations.ingredients,
        usageVi: viTranslations.usageInstructions,
        usageZh: zhTranslations.usageInstructions,
        imageId: productImages.id,
        imageUrl: productImages.url,
      })
      .from(products)
      .innerJoin(
        viTranslations,
        and(eq(viTranslations.productId, products.id), eq(viTranslations.locale, 'vi'))
      )
      .leftJoin(
        zhTranslations,
        and(eq(zhTranslations.productId, products.id), eq(zhTranslations.locale, 'zh'))
      )
      .leftJoin(
        productImages,
        and(eq(productImages.productId, products.id), eq(productImages.role, 'primary'))
      )
      .where(eq(products.id, id))
      .limit(1);

    if (!row) return null;

    let altVi = '';
    let altZh = '';
    if (row.imageId) {
      const altRows = await db
        .select({ locale: productImageTranslations.locale, alt: productImageTranslations.alt })
        .from(productImageTranslations)
        .where(eq(productImageTranslations.imageId, row.imageId));
      for (const a of altRows) {
        if (a.locale === 'vi') altVi = a.alt;
        if (a.locale === 'zh') altZh = a.alt;
      }
    }

    // --- Read-only aggregates -------------------------------------------
    // None of these are editable through the current admin API yet (see
    // the Product Editor audit) -- fetched here purely so the edit page
    // can show what real data already exists rather than hiding it or
    // fabricating an empty-looking product.

    const allImageRows = await db
      .select({
        id: productImages.id,
        url: productImages.url,
        role: productImages.role,
        sortOrder: productImages.sortOrder,
        width: productImages.width,
        height: productImages.height,
      })
      .from(productImages)
      .where(eq(productImages.productId, id))
      .orderBy(asc(productImages.sortOrder));

    const imageAltRows = allImageRows.length
      ? await db
          .select({ imageId: productImageTranslations.imageId, locale: productImageTranslations.locale, alt: productImageTranslations.alt })
          .from(productImageTranslations)
          .where(inArray(productImageTranslations.imageId, allImageRows.map((r) => r.id)))
      : [];
    const altByImage = new Map<string, { vi: string | null; zh: string | null }>();
    for (const a of imageAltRows) {
      const entry = altByImage.get(a.imageId) ?? { vi: null, zh: null };
      if (a.locale === 'vi') entry.vi = a.alt;
      if (a.locale === 'zh') entry.zh = a.alt;
      altByImage.set(a.imageId, entry);
    }
    const images: AdminProductImageSummary[] = allImageRows.map((r) => ({
      id: r.id,
      url: r.url,
      role: r.role,
      sortOrder: r.sortOrder,
      width: r.width,
      height: r.height,
      altVi: altByImage.get(r.id)?.vi ?? null,
      altZh: altByImage.get(r.id)?.zh ?? null,
    }));

    const benefitRows = await db
      .select({ id: productBenefits.id, locale: productBenefits.locale, text: productBenefits.text, claimType: productBenefits.claimType, sortOrder: productBenefits.sortOrder })
      .from(productBenefits)
      .where(eq(productBenefits.productId, id))
      .orderBy(asc(productBenefits.locale), asc(productBenefits.sortOrder));
    const benefits: AdminProductBenefitSummary[] = benefitRows.map((r) => ({
      id: r.id,
      locale: r.locale as 'vi' | 'zh',
      text: r.text,
      claimType: r.claimType,
      sortOrder: r.sortOrder,
    }));

    const warningRows = await db
      .select({ id: productWarnings.id, locale: productWarnings.locale, text: productWarnings.text, sortOrder: productWarnings.sortOrder })
      .from(productWarnings)
      .where(eq(productWarnings.productId, id))
      .orderBy(asc(productWarnings.locale), asc(productWarnings.sortOrder));
    const warnings: AdminProductWarningSummary[] = warningRows.map((r) => ({
      id: r.id,
      locale: r.locale as 'vi' | 'zh',
      text: r.text,
      sortOrder: r.sortOrder,
    }));

    const certificationRows = await db
      .select({
        id: productCertifications.id,
        certType: productCertifications.certType,
        issuingBody: productCertifications.issuingBody,
        certificateNumber: productCertifications.certificateNumber,
        validFrom: productCertifications.validFrom,
        validTo: productCertifications.validTo,
      })
      .from(productCertifications)
      .where(eq(productCertifications.productId, id));
    const certifications: AdminProductCertificationSummary[] = certificationRows;

    const variantRows = await db
      .select({
        id: productVariants.id,
        sku: productVariants.sku,
        isDefault: productVariants.isDefault,
        netQuantityValue: productVariants.netQuantityValue,
        netQuantityUnit: productVariants.netQuantityUnit,
        containerType: productVariants.containerType,
        gtin: productVariants.gtin,
      })
      .from(productVariants)
      .where(eq(productVariants.productId, id))
      .orderBy(asc(productVariants.sortOrder));

    const variantIds = variantRows.map((v) => v.id);
    const [variantLabelRows, priceMap, inventoryRows] = await Promise.all([
      variantIds.length
        ? db
            .select({ variantId: productVariantTranslations.variantId, locale: productVariantTranslations.locale, label: productVariantTranslations.label })
            .from(productVariantTranslations)
            .where(inArray(productVariantTranslations.variantId, variantIds))
        : Promise.resolve([]),
      fetchCurrentPricingForVariants(variantIds),
      variantIds.length
        ? db
            .select({ variantId: inventory.variantId, quantity: inventory.quantity, lowStockThreshold: inventory.lowStockThreshold })
            .from(inventory)
            .where(inArray(inventory.variantId, variantIds))
        : Promise.resolve([]),
    ]);
    const labelByVariant = new Map<string, { vi: string | null; zh: string | null }>();
    for (const l of variantLabelRows) {
      const entry = labelByVariant.get(l.variantId) ?? { vi: null, zh: null };
      if (l.locale === 'vi') entry.vi = l.label;
      if (l.locale === 'zh') entry.zh = l.label;
      labelByVariant.set(l.variantId, entry);
    }
    const inventoryByVariant = new Map(inventoryRows.map((r) => [r.variantId, r]));

    const variants: AdminProductVariantSummary[] = variantRows.map((v) => {
      const price = priceMap.get(v.id);
      const inv = inventoryByVariant.get(v.id);
      return {
        id: v.id,
        sku: v.sku,
        isDefault: v.isDefault,
        labelVi: labelByVariant.get(v.id)?.vi ?? null,
        labelZh: labelByVariant.get(v.id)?.zh ?? null,
        netQuantityValue: v.netQuantityValue != null ? Number(v.netQuantityValue) : null,
        netQuantityUnit: v.netQuantityUnit,
        containerType: v.containerType,
        gtin: v.gtin,
        priceMinor: price?.priceMinor ?? null,
        compareAtMinor: price?.compareAtMinor ?? null,
        currency: price?.currency ?? null,
        inventoryQuantity: inv?.quantity ?? null,
        lowStockThreshold: inv?.lowStockThreshold ?? null,
      };
    });

    return {
      id: row.id,
      slug: row.slug,
      categoryId: row.categoryId,
      isFeatured: row.isFeatured,
      isPublished: row.isPublished,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      botanicalName: row.botanicalName,
      countryOfOriginCode: row.countryOfOriginCode,
      extractionMethod: row.extractionMethod,
      manufacturerName: row.manufacturerName,
      nameVi: row.nameVi,
      nameZh: row.nameZh ?? '',
      shortDescriptionVi: row.shortDescriptionVi,
      shortDescriptionZh: row.shortDescriptionZh ?? null,
      descriptionVi: row.descriptionVi,
      descriptionZh: row.descriptionZh ?? null,
      ingredientsVi: row.ingredientsVi,
      ingredientsZh: row.ingredientsZh ?? null,
      usageVi: row.usageVi,
      usageZh: row.usageZh ?? null,
      imageId: row.imageId,
      image: row.imageId && row.imageUrl ? { url: row.imageUrl, altVi, altZh } : null,
      images,
      benefits,
      warnings,
      certifications,
      variants,
    };
  }

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    const condition = excludeId
      ? and(eq(products.slug, slug), ne(products.id, excludeId))
      : eq(products.slug, slug);
    const [row] = await db.select({ id: products.id }).from(products).where(condition).limit(1);
    return !!row;
  }

  // --- Repeatable-child-record replace-sets --------------------------
  // Shared by create() and update(): each of these takes the FULL set of
  // rows the operator wants a product to have for one child table and
  // makes the DB match it exactly -- delete whatever's no longer
  // present, upsert (by id) whatever is. This is deliberately a
  // replace-set, not a diff/patch API: the admin form always resubmits
  // the whole section (see AdminProductChildInput's doc comment), so
  // there's no separate add/remove endpoint to keep in sync. `tx` is
  // typed structurally off `db.transaction` itself rather than importing
  // Drizzle's transaction generic by name, so these stay correct if the
  // underlying driver/version ever changes.

  private async replaceBenefits(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    productId: string,
    rows: AdminProductBenefitInput[]
  ): Promise<void> {
    const keepIds = rows.map((r) => r.id).filter((id): id is string => id !== null);
    await tx.delete(productBenefits).where(
      keepIds.length > 0
        ? and(eq(productBenefits.productId, productId), not(inArray(productBenefits.id, keepIds)))
        : eq(productBenefits.productId, productId)
    );
    for (const row of rows) {
      const id = row.id ?? randomUUID();
      await tx
        .insert(productBenefits)
        .values({ id, productId, locale: row.locale, text: row.text, claimType: row.claimType, sortOrder: row.sortOrder })
        .onConflictDoUpdate({
          target: productBenefits.id,
          set: { locale: row.locale, text: row.text, claimType: row.claimType, sortOrder: row.sortOrder },
        });
    }
  }

  private async replaceWarnings(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    productId: string,
    rows: AdminProductWarningInput[]
  ): Promise<void> {
    const keepIds = rows.map((r) => r.id).filter((id): id is string => id !== null);
    await tx.delete(productWarnings).where(
      keepIds.length > 0
        ? and(eq(productWarnings.productId, productId), not(inArray(productWarnings.id, keepIds)))
        : eq(productWarnings.productId, productId)
    );
    for (const row of rows) {
      const id = row.id ?? randomUUID();
      await tx
        .insert(productWarnings)
        .values({ id, productId, locale: row.locale, text: row.text, sortOrder: row.sortOrder })
        .onConflictDoUpdate({
          target: productWarnings.id,
          set: { locale: row.locale, text: row.text, sortOrder: row.sortOrder },
        });
    }
  }

  private async replaceCertifications(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    productId: string,
    rows: AdminProductCertificationInput[]
  ): Promise<void> {
    const keepIds = rows.map((r) => r.id).filter((id): id is string => id !== null);
    await tx.delete(productCertifications).where(
      keepIds.length > 0
        ? and(eq(productCertifications.productId, productId), not(inArray(productCertifications.id, keepIds)))
        : eq(productCertifications.productId, productId)
    );
    for (const row of rows) {
      const id = row.id ?? randomUUID();
      await tx
        .insert(productCertifications)
        .values({
          id,
          productId,
          certType: row.certType,
          issuingBody: row.issuingBody,
          certificateNumber: row.certificateNumber,
          validFrom: row.validFrom,
          validTo: row.validTo,
        })
        .onConflictDoUpdate({
          target: productCertifications.id,
          set: {
            certType: row.certType,
            issuingBody: row.issuingBody,
            certificateNumber: row.certificateNumber,
            validFrom: row.validFrom,
            validTo: row.validTo,
          },
        });
    }
  }

  /** Gallery (role: 'gallery') images only -- the primary image is a
   *  separate field with its own established code path (see create()/
   *  update() below) and is never touched here; `role: 'thumbnail'` rows
   *  (a third value the DB's check constraint allows) are also left
   *  alone since nothing in this codebase creates them and this replace-
   *  set has no representation for that role to preserve or recreate. */
  private async replaceGalleryImages(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    productId: string,
    rows: Array<{ input: AdminProductGalleryImageInput; probed: { width: number; height: number } }>
  ): Promise<void> {
    const keepIds = rows.map((r) => r.input.id).filter((id): id is string => id !== null);
    const galleryCondition = and(eq(productImages.productId, productId), eq(productImages.role, 'gallery'));
    await tx.delete(productImages).where(
      keepIds.length > 0 ? and(galleryCondition, not(inArray(productImages.id, keepIds))) : galleryCondition
    );
    for (const { input, probed } of rows) {
      const id = input.id ?? randomUUID();
      await tx
        .insert(productImages)
        .values({
          id,
          productId,
          url: input.url,
          role: 'gallery',
          width: probed.width,
          height: probed.height,
          sortOrder: input.sortOrder,
        })
        .onConflictDoUpdate({
          target: productImages.id,
          set: { url: input.url, width: probed.width, height: probed.height, sortOrder: input.sortOrder },
        });
      for (const loc of ['vi', 'zh'] as const) {
        const alt = loc === 'vi' ? input.altVi : input.altZh;
        await tx
          .insert(productImageTranslations)
          .values({ imageId: id, locale: loc, alt })
          .onConflictDoUpdate({
            target: [productImageTranslations.imageId, productImageTranslations.locale],
            set: { alt },
          });
      }
    }
  }

  /** Probes every gallery image URL's real dimensions BEFORE any
   *  transaction opens -- same reasoning as the primary image's probe in
   *  create()/update(): no point holding a DB transaction open across an
   *  external image fetch. Probing an unchanged URL again on every save
   *  is intentionally simple/inefficient here (not cached against the
   *  existing row) -- correctness over a caching optimization this pass. */
  private async probeGalleryImages(
    rows: AdminProductGalleryImageInput[]
  ): Promise<Array<{ input: AdminProductGalleryImageInput; probed: { width: number; height: number } }>> {
    return Promise.all(
      rows.map(async (input) => ({ input, probed: await probeImageDimensions(input.url) }))
    );
  }

  /** Upserts a single variant's current effective pricing row in place
   *  (or inserts a new one if none is currently active) rather than ever
   *  starting a new effective-dated version. This editor has no UI for
   *  "schedule a future price change" -- the only thing an operator can
   *  do here is set what the price *is right now* -- so the smallest safe
   *  design is to edit today's active row directly, never fabricating an
   *  effectiveFrom/effectiveTo cutoff. `price: null` means the operator
   *  left the price field blank -- the existing pricing row (if any) is
   *  left completely untouched, same "null = don't touch" convention as
   *  the primary image field. */
  private async upsertCurrentPrice(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    variantId: string,
    price: AdminProductVariantInput['price']
  ): Promise<void> {
    if (!price) return; // untouched -- leave whatever pricing exists as-is.

    const now = sql`now()`;
    const [activeRow] = await tx
      .select({ id: pricing.id })
      .from(pricing)
      .where(
        and(
          eq(pricing.variantId, variantId),
          lte(pricing.effectiveFrom, now),
          or(isNull(pricing.effectiveTo), gt(pricing.effectiveTo, now))
        )
      )
      .orderBy(desc(pricing.effectiveFrom))
      .limit(1);

    if (price.action === 'clear') {
      // No orders/checkout table anywhere references a pricing row by id
      // (verified against src/db/schema.ts) -- deleting the current
      // effective row just means this variant now has no current price,
      // a state every consumer already handles (see
      // AdminProductVariantPriceInput's doc comment). A no-op if nothing
      // is currently active.
      if (activeRow) {
        await tx.delete(pricing).where(eq(pricing.id, activeRow.id));
      }
      return;
    }

    if (activeRow) {
      await tx
        .update(pricing)
        .set({ priceMinor: price.priceMinor, compareAtMinor: price.compareAtMinor, currency: price.currency })
        .where(eq(pricing.id, activeRow.id));
    } else {
      await tx.insert(pricing).values({
        id: randomUUID(),
        variantId,
        priceMinor: price.priceMinor,
        compareAtMinor: price.compareAtMinor,
        currency: price.currency,
      });
    }
  }

  /** Variants, folding in their 1:1 pricing/inventory writes (see
   *  upsertCurrentPrice's doc comment for the pricing semantics).
   *  `keepIds`-based delete + per-row upsert, same replace-set shape as
   *  every other repeatable child record -- deleting a variant here
   *  cascades to its own pricing/inventory/translation rows (see
   *  src/db/schema.ts's onDelete: 'cascade' on all three). Label
   *  translations are written per-locale only when the operator actually
   *  entered one; a blank label deletes that locale's row rather than
   *  writing an empty string (product_variant_translations.label is
   *  NOT NULL). Inventory is always upserted (never deleted) when
   *  provided -- there's no "remove inventory tracking" concept here,
   *  just "set it to unknown," which nullable quantity/threshold already
   *  cover. */
  private async replaceVariants(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    productId: string,
    rows: AdminProductVariantInput[]
  ): Promise<void> {
    const keepIds = rows.map((r) => r.id).filter((id): id is string => id !== null);
    await tx.delete(productVariants).where(
      keepIds.length > 0
        ? and(eq(productVariants.productId, productId), not(inArray(productVariants.id, keepIds)))
        : eq(productVariants.productId, productId)
    );

    for (const row of rows) {
      const id = row.id ?? randomUUID();
      await tx
        .insert(productVariants)
        .values({
          id,
          productId,
          sku: row.sku,
          isDefault: row.isDefault,
          sortOrder: row.sortOrder,
          netQuantityValue: row.netQuantityValue !== null ? String(row.netQuantityValue) : null,
          netQuantityUnit: row.netQuantityUnit,
          containerType: row.containerType,
          gtin: row.gtin,
        })
        .onConflictDoUpdate({
          target: productVariants.id,
          set: {
            sku: row.sku,
            isDefault: row.isDefault,
            sortOrder: row.sortOrder,
            netQuantityValue: row.netQuantityValue !== null ? String(row.netQuantityValue) : null,
            netQuantityUnit: row.netQuantityUnit,
            containerType: row.containerType,
            gtin: row.gtin,
          },
        });

      for (const loc of ['vi', 'zh'] as const) {
        const label = loc === 'vi' ? row.labelVi : row.labelZh;
        if (label === null) {
          await tx
            .delete(productVariantTranslations)
            .where(and(eq(productVariantTranslations.variantId, id), eq(productVariantTranslations.locale, loc)));
        } else {
          await tx
            .insert(productVariantTranslations)
            .values({ variantId: id, locale: loc, label })
            .onConflictDoUpdate({
              target: [productVariantTranslations.variantId, productVariantTranslations.locale],
              set: { label },
            });
        }
      }

      await this.upsertCurrentPrice(tx, id, row.price);

      if (row.inventory) {
        await tx
          .insert(inventory)
          .values({ variantId: id, quantity: row.inventory.quantity, lowStockThreshold: row.inventory.lowStockThreshold, updatedAt: new Date() })
          .onConflictDoUpdate({
            target: inventory.variantId,
            set: { quantity: row.inventory.quantity, lowStockThreshold: row.inventory.lowStockThreshold, updatedAt: new Date() },
          });
      }
    }
  }

  async create(input: AdminProductWriteInput): Promise<{ id: string }> {
    // Matches the `${categoryId}:${slug}` id convention every seeded
    // product already uses (see src/server/seed/seed-natural-oils.ts) --
    // id stays a stable primary key from here on even if the product's
    // slug/category are edited later (see update() below, which never
    // touches `id`).
    const id = `${input.categoryId}:${input.slug}`;

    // Probe BEFORE opening the transaction: no point holding a DB
    // transaction open while waiting on an external image fetch.
    const probedImage = input.image ? await probeImageDimensions(input.image.url) : null;
    const probedGalleryImages = await this.probeGalleryImages(input.galleryImages);

    await db.transaction(async (tx) => {
      await tx.insert(products).values({
        id,
        slug: input.slug,
        categoryId: input.categoryId,
        isFeatured: input.isFeatured,
        isPublished: input.isPublished,
        sortOrder: input.sortOrder,
        botanicalName: input.botanicalName,
        countryOfOriginCode: input.countryOfOriginCode,
        extractionMethod: input.extractionMethod,
        manufacturerName: input.manufacturerName,
      });

      await tx.insert(productTranslations).values(translationRows(id, input));

      if (input.image && probedImage) {
        const imageId = randomUUID();
        await tx.insert(productImages).values({
          id: imageId,
          productId: id,
          url: input.image.url,
          role: 'primary',
          width: probedImage.width,
          height: probedImage.height,
          sortOrder: 0,
        });
        await tx.insert(productImageTranslations).values([
          { imageId, locale: 'vi', alt: input.image.altVi },
          { imageId, locale: 'zh', alt: input.image.altZh },
        ]);
      }

      // A newly-created product's id is only known once the product row
      // above exists, so every repeatable child record is created here,
      // in the same transaction, rather than requiring a second "now add
      // benefits/warnings/etc." edit-mode save.
      await this.replaceBenefits(tx, id, input.benefits);
      await this.replaceWarnings(tx, id, input.warnings);
      await this.replaceCertifications(tx, id, input.certifications);
      await this.replaceGalleryImages(tx, id, probedGalleryImages);
      await this.replaceVariants(tx, id, input.variants);
    });

    return { id };
  }

  async update(id: string, input: AdminProductWriteInput): Promise<void> {
    const probedImage = input.image ? await probeImageDimensions(input.image.url) : null;
    const probedGalleryImages = await this.probeGalleryImages(input.galleryImages);

    await db.transaction(async (tx) => {
      const [existing] = await tx.select({ id: products.id }).from(products).where(eq(products.id, id)).limit(1);
      if (!existing) {
        throw new Error(`Product "${id}" not found.`);
      }

      await tx
        .update(products)
        .set({
          slug: input.slug,
          categoryId: input.categoryId,
          isFeatured: input.isFeatured,
          isPublished: input.isPublished,
          sortOrder: input.sortOrder,
          botanicalName: input.botanicalName,
          countryOfOriginCode: input.countryOfOriginCode,
          extractionMethod: input.extractionMethod,
          manufacturerName: input.manufacturerName,
          updatedAt: new Date(),
        })
        .where(eq(products.id, id));

      // Upsert (not plain update) for the same reason the seed script
      // uses onConflictDoUpdate throughout: robust even if a translation
      // row were ever missing for some reason, not just the expected path.
      for (const row of translationRows(id, input)) {
        await tx
          .insert(productTranslations)
          .values(row)
          .onConflictDoUpdate({
            target: [productTranslations.productId, productTranslations.locale],
            set: {
              name: row.name,
              shortDescription: row.shortDescription,
              description: row.description,
              ingredients: row.ingredients,
              usageInstructions: row.usageInstructions,
            },
          });
      }

      if (input.image && probedImage) {
        const [existingImage] = await tx
          .select({ id: productImages.id })
          .from(productImages)
          .where(and(eq(productImages.productId, id), eq(productImages.role, 'primary')))
          .limit(1);

        const imageId = existingImage?.id ?? randomUUID();

        await tx
          .insert(productImages)
          .values({
            id: imageId,
            productId: id,
            url: input.image.url,
            role: 'primary',
            width: probedImage.width,
            height: probedImage.height,
            sortOrder: 0,
          })
          .onConflictDoUpdate({
            target: productImages.id,
            set: { url: input.image.url, width: probedImage.width, height: probedImage.height },
          });

        for (const loc of ['vi', 'zh'] as const) {
          const alt = loc === 'vi' ? input.image.altVi : input.image.altZh;
          await tx
            .insert(productImageTranslations)
            .values({ imageId, locale: loc, alt })
            .onConflictDoUpdate({
              target: [productImageTranslations.imageId, productImageTranslations.locale],
              set: { alt },
            });
        }
      }

      await this.replaceBenefits(tx, id, input.benefits);
      await this.replaceWarnings(tx, id, input.warnings);
      await this.replaceCertifications(tx, id, input.certifications);
      await this.replaceGalleryImages(tx, id, probedGalleryImages);
      await this.replaceVariants(tx, id, input.variants);
    });
  }

  async delete(id: string): Promise<void> {
    // Every child table references products.id with onDelete: 'cascade'
    // (see src/db/schema.ts) -- one statement is enough.
    await db.delete(products).where(eq(products.id, id));
  }

  async deleteMany(ids: string[]): Promise<{ deleted: string[] }> {
    if (ids.length === 0) return { deleted: [] };

    // One atomic, parameterized DELETE ... WHERE id IN (...) -- never N
    // independent per-row deletes, and ids are always bound as query
    // parameters by Drizzle's `inArray`, never interpolated into raw SQL.
    // A single DELETE statement is already atomic under Postgres's normal
    // statement-level atomicity (all rows it touches are removed, or on
    // any error none are and the whole statement rolls back) -- there is
    // no multi-statement sequence here that needs an explicit
    // db.transaction() wrapper.
    const deletedRows = await db.delete(products).where(inArray(products.id, ids)).returning({ id: products.id });
    return { deleted: deletedRows.map((r) => r.id) };
  }
}

export const adminProductRepository: AdminProductRepository = new PostgresAdminProductRepository();
