/**
 * Turns a raw JSON request body from the admin product form into a
 * validated AdminProductInput, or throws ValidationError with a message
 * safe to show the operator directly. Shared by the create (POST) and
 * update (PATCH) routes under src/pages/api/admin/products/ so both stay
 * in sync on what "valid" means.
 */
import type { AdminProductWriteInput } from '../../domain/admin-types';

export interface AdminProductFormPayload {
  slug?: unknown;
  categoryId?: unknown;
  isFeatured?: unknown;
  isPublished?: unknown;
  sortOrder?: unknown;
  nameVi?: unknown;
  nameZh?: unknown;
  shortDescriptionVi?: unknown;
  shortDescriptionZh?: unknown;
  descriptionVi?: unknown;
  descriptionZh?: unknown;
  ingredientsVi?: unknown;
  ingredientsZh?: unknown;
  usageVi?: unknown;
  usageZh?: unknown;
  botanicalName?: unknown;
  countryOfOriginCode?: unknown;
  extractionMethod?: unknown;
  manufacturerName?: unknown;
  imageUrl?: unknown;
  imageAltVi?: unknown;
  imageAltZh?: unknown;
  benefits?: unknown;
  warnings?: unknown;
  certifications?: unknown;
  galleryImages?: unknown;
  variants?: unknown;
}

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export class ValidationError extends Error {}

function str(value: unknown, field: string, opts: { required?: boolean } = {}): string {
  if (value === undefined || value === null) {
    if (opts.required) throw new ValidationError(`${field} is required.`);
    return '';
  }
  if (typeof value !== 'string') {
    throw new ValidationError(`${field} must be a string.`);
  }
  const trimmed = value.trim();
  if (opts.required && trimmed.length === 0) {
    throw new ValidationError(`${field} is required.`);
  }
  return trimmed;
}

function nullableStr(value: unknown, field: string): string | null {
  const s = str(value, field);
  return s.length === 0 ? null : s;
}

/** A row-level `id` from the client: an existing row's real id (kept as
 *  a string, opaque to this layer), or '' / missing / non-string, which
 *  all mean "new row -- let the repository generate an id." */
function rowId(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asRecordArray(value: unknown, field: string): Record<string, unknown>[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ValidationError(`${field} must be an array.`);
  return value.map((item, i) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new ValidationError(`${field}[${i}] must be an object.`);
    }
    return item as Record<string, unknown>;
  });
}

function parseBenefits(raw: unknown): AdminProductWriteInput['benefits'] {
  return asRecordArray(raw, 'benefits').map((o, i) => {
    const locale = o.locale;
    if (locale !== 'vi' && locale !== 'zh') {
      throw new ValidationError(`benefits[${i}].locale must be "vi" or "zh".`);
    }
    const claimType = o.claimType;
    if (claimType !== 'factual' && claimType !== 'marketing' && claimType !== 'structure_function') {
      throw new ValidationError(`benefits[${i}].claimType must be "factual", "marketing", or "structure_function".`);
    }
    return {
      id: rowId(o.id),
      locale,
      text: str(o.text, `benefits[${i}].text`, { required: true }),
      claimType,
      sortOrder: i,
    };
  });
}

function parseWarnings(raw: unknown): AdminProductWriteInput['warnings'] {
  return asRecordArray(raw, 'warnings').map((o, i) => {
    const locale = o.locale;
    if (locale !== 'vi' && locale !== 'zh') {
      throw new ValidationError(`warnings[${i}].locale must be "vi" or "zh".`);
    }
    return {
      id: rowId(o.id),
      locale,
      text: str(o.text, `warnings[${i}].text`, { required: true }),
      sortOrder: i,
    };
  });
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function nullableDateStr(value: unknown, field: string): string | null {
  const s = nullableStr(value, field);
  if (s !== null && !ISO_DATE_PATTERN.test(s)) {
    throw new ValidationError(`${field} must be a date in YYYY-MM-DD format.`);
  }
  return s;
}

function parseCertifications(raw: unknown): AdminProductWriteInput['certifications'] {
  return asRecordArray(raw, 'certifications').map((o, i) => ({
    id: rowId(o.id),
    certType: str(o.certType, `certifications[${i}].certType`, { required: true }),
    issuingBody: nullableStr(o.issuingBody, `certifications[${i}].issuingBody`),
    certificateNumber: nullableStr(o.certificateNumber, `certifications[${i}].certificateNumber`),
    validFrom: nullableDateStr(o.validFrom, `certifications[${i}].validFrom`),
    validTo: nullableDateStr(o.validTo, `certifications[${i}].validTo`),
  }));
}

function parseGalleryImages(raw: unknown): AdminProductWriteInput['galleryImages'] {
  return asRecordArray(raw, 'galleryImages').map((o, i) => ({
    id: rowId(o.id),
    url: str(o.url, `galleryImages[${i}].url`, { required: true }),
    altVi: str(o.altVi, `galleryImages[${i}].altVi`, { required: true }),
    altZh: str(o.altZh, `galleryImages[${i}].altZh`, { required: true }),
    sortOrder: i,
  }));
}

/** A blank/missing value means "not entered" (not "zero") -- distinct from
 *  `num()`, which is used for fields (like sortOrder) that always have a
 *  value. Used for price/inventory numbers, which are genuinely optional. */
function nullableNum(value: unknown, field: string, opts: { integer?: boolean; min?: number } = {}): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) throw new ValidationError(`${field} must be a number.`);
  if (opts.integer && !Number.isInteger(n)) throw new ValidationError(`${field} must be a whole number.`);
  if (opts.min !== undefined && n < opts.min) throw new ValidationError(`${field} must be ${opts.min} or greater.`);
  return n;
}

const NET_QUANTITY_UNITS = new Set(['ml', 'l', 'g', 'fl_oz']);

function parseVariants(raw: unknown): AdminProductWriteInput['variants'] {
  const rows = asRecordArray(raw, 'variants').map((o, i) => {
    const sku = str(o.sku, `variants[${i}].sku`, { required: true });
    const isDefault = o.isDefault === true || o.isDefault === 'true' || o.isDefault === 'on';

    const netQuantityUnitRaw = nullableStr(o.netQuantityUnit, `variants[${i}].netQuantityUnit`);
    if (netQuantityUnitRaw !== null && !NET_QUANTITY_UNITS.has(netQuantityUnitRaw)) {
      throw new ValidationError(`variants[${i}].netQuantityUnit must be one of ml, l, g, fl_oz.`);
    }
    const netQuantityUnit = netQuantityUnitRaw as 'ml' | 'l' | 'g' | 'fl_oz' | null;

    // Three states, not two -- see AdminProductVariantPriceInput's doc
    // comment. `clearPrice` is a distinct explicit flag (set only by the
    // form's "Remove price" action) so a merely-blank price input can
    // never be mistaken for "delete the existing price": the flag is the
    // ONLY thing that triggers a clear, regardless of what priceMinor
    // contains alongside it.
    const clearPrice = o.clearPrice === true || o.clearPrice === 'true' || o.clearPrice === 'on';
    const priceMinor = nullableNum(o.priceMinor, `variants[${i}].priceMinor`, { integer: true, min: 0 });
    let price: AdminProductWriteInput['variants'][number]['price'] = null;
    if (clearPrice) {
      price = { action: 'clear' };
    } else if (priceMinor !== null) {
      const compareAtMinor = nullableNum(o.compareAtMinor, `variants[${i}].compareAtMinor`, { integer: true, min: 0 });
      const currency = str(o.currency, `variants[${i}].currency`) || 'VND';
      price = { action: 'set', priceMinor, compareAtMinor, currency };
    }

    const quantity = nullableNum(o.inventoryQuantity, `variants[${i}].inventoryQuantity`, { integer: true, min: 0 });
    const lowStockThreshold = nullableNum(o.lowStockThreshold, `variants[${i}].lowStockThreshold`, { integer: true, min: 0 });
    const inventory = (quantity !== null || lowStockThreshold !== null) ? { quantity, lowStockThreshold } : null;

    return {
      id: rowId(o.id),
      sku,
      isDefault,
      labelVi: nullableStr(o.labelVi, `variants[${i}].labelVi`),
      labelZh: nullableStr(o.labelZh, `variants[${i}].labelZh`),
      netQuantityValue: nullableNum(o.netQuantityValue, `variants[${i}].netQuantityValue`, { min: 0 }),
      netQuantityUnit,
      containerType: nullableStr(o.containerType, `variants[${i}].containerType`),
      gtin: nullableStr(o.gtin, `variants[${i}].gtin`),
      sortOrder: i,
      price,
      inventory,
    };
  });

  // The DB only enforces "at most one default variant per product" (a
  // partial unique index -- see idx_variants_one_default in
  // src/db/schema.ts), not "exactly one." Rejecting more than one here
  // gives a clear 400 instead of letting a same-transaction insert hit
  // that unique index and surface as an opaque 500/409.
  if (rows.filter((r) => r.isDefault).length > 1) {
    throw new ValidationError('Only one variant can be marked as the default.');
  }

  return rows;
}

export function parseAdminProductInput(body: AdminProductFormPayload): AdminProductWriteInput {
  const slug = str(body.slug, 'slug', { required: true });
  if (!SLUG_PATTERN.test(slug)) {
    throw new ValidationError(
      'Slug must be lowercase letters, numbers, and hyphens only (e.g. "coconut-oil").'
    );
  }

  const categoryId = str(body.categoryId, 'categoryId', { required: true });
  const nameVi = str(body.nameVi, 'nameVi', { required: true });
  const nameZh = str(body.nameZh, 'nameZh', { required: true });

  const sortOrderRaw = body.sortOrder;
  const sortOrder = typeof sortOrderRaw === 'number' ? sortOrderRaw : Number(sortOrderRaw ?? 0);
  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    throw new ValidationError('Sort order must be a non-negative whole number.');
  }

  const isFeatured = body.isFeatured === true || body.isFeatured === 'true' || body.isFeatured === 'on';
  const isPublished = body.isPublished === true || body.isPublished === 'true' || body.isPublished === 'on';

  const imageUrl = str(body.imageUrl, 'imageUrl');
  let image: AdminProductWriteInput['image'] = null;
  if (imageUrl.length > 0) {
    const altVi = str(body.imageAltVi, 'imageAltVi', { required: true });
    const altZh = str(body.imageAltZh, 'imageAltZh', { required: true });
    image = { url: imageUrl, altVi, altZh };
  }

  return {
    slug,
    categoryId,
    isFeatured,
    isPublished,
    sortOrder,
    nameVi,
    nameZh,
    shortDescriptionVi: nullableStr(body.shortDescriptionVi, 'shortDescriptionVi'),
    shortDescriptionZh: nullableStr(body.shortDescriptionZh, 'shortDescriptionZh'),
    descriptionVi: nullableStr(body.descriptionVi, 'descriptionVi'),
    descriptionZh: nullableStr(body.descriptionZh, 'descriptionZh'),
    ingredientsVi: nullableStr(body.ingredientsVi, 'ingredientsVi'),
    ingredientsZh: nullableStr(body.ingredientsZh, 'ingredientsZh'),
    usageVi: nullableStr(body.usageVi, 'usageVi'),
    usageZh: nullableStr(body.usageZh, 'usageZh'),
    botanicalName: nullableStr(body.botanicalName, 'botanicalName'),
    countryOfOriginCode: nullableStr(body.countryOfOriginCode, 'countryOfOriginCode'),
    extractionMethod: nullableStr(body.extractionMethod, 'extractionMethod'),
    manufacturerName: nullableStr(body.manufacturerName, 'manufacturerName'),
    image,
    benefits: parseBenefits(body.benefits),
    warnings: parseWarnings(body.warnings),
    certifications: parseCertifications(body.certifications),
    galleryImages: parseGalleryImages(body.galleryImages),
    variants: parseVariants(body.variants),
  };
}
