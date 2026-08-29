/**
 * Presentation-layer fallback for products that don't have a real photo in
 * `product_images` yet. Deliberately NOT part of the repository/domain
 * layer — the database has no opinion about this asset, it's a purely
 * visual placeholder until real product photography exists (see
 * architecture audit §7/§8: "do not create fake product-image rows
 * pointing at shared placeholder bytes").
 *
 * The asset itself is intentionally abstract line art (see the .svg file:
 * a generic bottle silhouette, no label/text/logo, brand colors only) --
 * NOT a photograph of any real product. An earlier version of this file
 * pointed at a raster photo of a competitor's branded bottle, which read
 * as (and functionally was) that competitor's product being displayed
 * across this entire catalog; that asset has been removed from the repo.
 * When real per-product photography lands, swap the import below -- this
 * is the one place every consumer (ProductDetail.astro, NaturalOils.astro,
 * the natural-oils listing pages) resolves the fallback from.
 *
 * This is the same asset previously imported directly inside
 * src/data/products/natural-oils.ts, now centralized so every page that
 * needs the fallback imports it from one place instead of re-importing
 * the raw asset file.
 */
// `ImageMetadata` is a global ambient type (declared in astro/client.d.ts)
// — it is NOT re-exported as a named type from the 'astro:assets' module,
// so it's used here without an import (matching how `astro check`
// actually resolves it; importing it from 'astro:assets' fails type
// checking even though the build succeeds either way).
import placeholderBottleAsset from '../assets/images/products/natural-oils/placeholder-bottle.svg';

export const naturalOilsPlaceholderImage: ImageMetadata = placeholderBottleAsset;
