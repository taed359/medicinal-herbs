/**
 * Repository interfaces — the ONLY contract Astro pages are allowed to
 * depend on for product/category data. Pages import these (via
 * `src/server/repositories/index.ts`), never the Postgres implementation
 * directly, and components never import from `src/server/**` at all.
 *
 * Every method that returns product/category content is locale-aware and
 * returns already-resolved strings (see src/domain/types.ts) — callers
 * never receive a multi-locale object and pick a field themselves.
 */
import type {
  Locale,
  ProductDetailView,
  ProductSummaryView,
  CategoryView,
  CategoryWithCountView,
} from '../../domain/types';

export interface ProductRepository {
  /** Single product by its (locale-invariant) slug, resolved into `locale`. */
  getBySlug(slug: string, locale: Locale): Promise<ProductDetailView | null>;

  /** All published products in a category, resolved into `locale`. */
  listByCategory(categoryId: string, locale: Locale): Promise<ProductSummaryView[]>;

  /** Featured, published products (homepage rail), resolved into `locale`. */
  listFeatured(limit: number, locale: Locale): Promise<ProductSummaryView[]>;

  /**
   * All published product slugs, locale-invariant. Powers
   * `getStaticPaths()` — slugs are the same URL segment under every
   * locale, so this intentionally takes no `locale` argument.
   */
  listAllSlugs(): Promise<string[]>;
}

export interface CategoryRepository {
  getBySlug(slug: string, locale: Locale): Promise<CategoryView | null>;
  listPublished(locale: Locale): Promise<CategoryView[]>;

  /**
   * All published categories, each with its published-product count.
   * Powers CategoryFilterList.astro (a category switcher/filter sidebar
   * shown on the product listing pages) -- separate from
   * `listPublished` so the common, count-free callers (breadcrumbs, nav)
   * never pay for the extra join/aggregation.
   */
  listPublishedWithCounts(locale: Locale): Promise<CategoryWithCountView[]>;
}
