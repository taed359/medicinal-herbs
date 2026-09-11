/**
 * Seeds one generic, non-specific `product_certifications` row per
 * product (all 34: 19 Natural Oils + 15 Wholesale) so the "Certifications"
 * section on the PDP has something to render instead of being hidden for
 * every product.
 *
 * DELIBERATELY NOT a real certification: `cert_type` is
 * 'internal-quality-check' (displays via formatCertType as "Internal
 * Quality Check", see src/lib/product-metadata-labels.ts), `issuingBody`/
 * `certificateNumber`/`validFrom`/`validTo` are all left NULL. This never
 * claims an external accreditation (no "USDA Organic", no "ISO", no real
 * certificate number/dates) that would not be true -- see this project's
 * anti-fabrication convention (product-image-fallback.ts's own doc
 * comment on the same principle). When a product earns a real
 * certificate, replace/extend its row with the real cert_type/
 * issuing_body/certificate_number/dates.
 *
 * Known, pre-existing limitation (not introduced or fixed by this
 * script): `formatCertType` has no locale parameter, so this label
 * currently renders in English on both /vi/ and /zh/ pages -- same as
 * for any other product that might get a certification today. A real
 * per-locale label would need its own follow-up change to
 * product-metadata-labels.ts + ProductDetail.astro's call site.
 *
 * Safe to re-run: ON CONFLICT DO UPDATE keyed on a deterministic id.
 */
import { db } from '../db/client';
import { productCertifications } from '../../db/schema';
import { PRODUCT_OIL_FAMILY } from '../../lib/oil-type-icons';

const CERT_TYPE = 'internal-quality-check';

async function main() {
  const productIds = Object.keys(PRODUCT_OIL_FAMILY);

  for (const productId of productIds) {
    const id = `${productId}:cert:internal-quality-check`;
    console.log(productId);

    await db
      .insert(productCertifications)
      .values({
        id,
        productId,
        certType: CERT_TYPE,
        issuingBody: null,
        certificateNumber: null,
        validFrom: null,
        validTo: null,
      })
      .onConflictDoUpdate({
        target: productCertifications.id,
        set: { certType: CERT_TYPE, issuingBody: null, certificateNumber: null, validFrom: null, validTo: null },
      });
  }

  console.log(`\nDone. Seeded 1 generic certification placeholder for ${productIds.length} products.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Product certifications seed failed:', err);
  process.exit(1);
});
