/**
 * Presentation-layer fallback for products that don't have a real photo in
 * `product_images` yet. Deliberately NOT part of the repository/domain
 * layer — the database has no opinion about this asset, it's a purely
 * visual placeholder until real product photography exists (see
 * architecture audit §7/§8: "do not create fake product-image rows
 * pointing at shared placeholder bytes").
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
import oilPlaceholderAsset from '../assets/images/products/natural-oils/oil-placeholder.webp';

export const naturalOilsPlaceholderImage: ImageMetadata = oilPlaceholderAsset;
