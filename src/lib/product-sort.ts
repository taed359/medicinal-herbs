import type { Locale } from '../i18n/utils';

export type SortKey = 'position' | 'name' | 'price';
export type SortDir = 'asc' | 'desc';

export interface SortableSummary {
  name: string;
  priceMinor: number | null;
}

/**
 * Sorts a full category's product summaries by the given key/direction.
 *
 * Always returns a NEW array -- never mutates `items` -- because every
 * sort variant a listing page's `getStaticPaths` generates (see e.g.
 * `src/pages/vi/products/natural-oils/[...page].astro`) re-sorts the
 * SAME base array fetched once per category/locale, and callers keep
 * reusing that original array for the other sort/direction combinations
 * afterwards.
 *
 * Why build-time, whole-category sort rather than sorting only the
 * current static page (or shipping the whole category as client JSON
 * and sorting in the browser): the user explicitly asked for sorting
 * that stays correct across the ENTIRE category, not just whatever
 * page happens to be loaded, AND asked for the design to keep working
 * if the catalog scales up a lot later. Sorting only the loaded page
 * would be visibly wrong the moment a category has more than one page
 * (item N on page 1 could be smaller/later than item 1 on page 2).
 * Shipping the whole category as JSON and sorting client-side would be
 * correct, but the page payload would grow linearly with catalog size --
 * exactly the "static-first, lightweight and fast" property the project
 * brief calls for, and directly in tension with the user's own "scale
 * lớn thì vẫn đảm bảo" ask. Sorting the WHOLE category at build time
 * (this function) and paginating each sorted order into its own set of
 * static pages (see getStaticPaths) keeps every rendered page's payload
 * proportional to `pageSize`, never to the category's total size -- the
 * same way plain pagination already scales today. The cost is build time
 * and static file count, which grow with (sort combinations x page
 * count) -- a few thousand small static files even at a 10,000-product
 * catalog, which Astro's static build handles fine; that tradeoff is
 * the right one for a storefront that is read far more often than it
 * is rebuilt.
 *
 * `position` is this project's existing default order -- the repository
 * already returns items ordered by `products.sortOrder` ascending (see
 * product-repository.ts's `listSummaries`), so "position ascending" is
 * just `items` as given (a plain copy) and "position descending" is a
 * plain reverse of that -- no comparator needed, and this is exactly the
 * order every listing page rendered before this Sort feature existed, so
 * the default (no `/sort/...` segment) route stays byte-for-byte
 * identical to what it already was.
 *
 * `name` uses `Intl.Collator` for locale-aware ordering (diacritics for
 * Vietnamese, sensible default collation for Chinese) rather than a
 * plain `.localeCompare()` with no locale, which would use the Node
 * build process's OS default locale instead of the storefront's actual
 * locale -- a subtle bug that would only show up as wrong sort order in
 * production, never in local dev if the developer's machine happens to
 * share a default locale.
 *
 * `price` compares `priceMinor` numerically. A `null` (price-on-request
 * -- see ProductSummaryView's own doc comment; every wholesale product
 * has this today) always sorts to the END regardless of direction, so a
 * "sort by price descending" never jumps a no-price item to the top.
 * The wholesale listing pages don't offer a Price sort option at all
 * (see each `[...page].astro`'s own `SORT_KEYS` constant), since every
 * wholesale product has `priceMinor: null` by design -- this null
 * handling exists mainly so this function stays correct if that ever
 * changes, or if a future category mixes priced and price-on-request
 * products.
 */
export function sortProductSummaries<T extends SortableSummary>(
  items: T[],
  key: SortKey,
  dir: SortDir,
  locale: Locale
): T[] {
  if (key === 'position') {
    const copy = items.slice();
    return dir === 'asc' ? copy : copy.reverse();
  }

  const sorted = items.slice();

  if (key === 'name') {
    const collator = new Intl.Collator(locale === 'zh' ? 'zh' : 'vi', { sensitivity: 'base' });
    sorted.sort((a, b) => collator.compare(a.name, b.name));
  } else {
    // key === 'price'
    sorted.sort((a, b) => {
      const priceA = a.priceMinor ?? Infinity;
      const priceB = b.priceMinor ?? Infinity;
      return priceA - priceB;
    });
  }

  return dir === 'asc' ? sorted : sorted.reverse();
}

/**
 * The `[...page]` route-param prefix for a sort combination, or `null`
 * for the default (position, ascending) -- which keeps its existing
 * bare URL (`/vi/products/natural-oils/`, `.../2/`, ...) completely
 * unchanged, for backward compatibility and SEO (see the project
 * brief's "Separate Vietnamese and Chinese URLs should remain
 * SEO-friendly and independently crawlable").
 */
export function sortRouteSlug(key: SortKey, dir: SortDir): string | null {
  if (key === 'position' && dir === 'asc') return null;
  return `sort/${key}-${dir}`;
}

/**
 * Locale-relative href for a given sort combination, built from the
 * listing's own plain `basePath` (same value `ProductToolbar` is given --
 * NOT `Pager`'s own `pagerBasePath`, which already has a sort slug folded
 * in; this function builds that slug itself).
 *
 * `pageNum` defaults to 1 (jump to the first page of the new combination)
 * but a caller may pass the CURRENT page to stay on it instead --
 * `ProductToolbar` does this for every link it renders, so picking a new
 * sort key or flipping direction keeps the visitor on the same page
 * number rather than always bouncing them back to page 1. This is safe
 * for ANY sort/direction combination within one category: `lastPage`
 * (`ceil(total / pageSize)`) depends only on the category's item COUNT
 * and `pageSize`, never on sort ORDER, so page N is always a real,
 * populated page under every combination this function can produce --
 * there's no "past the new last page" case to guard against. (An earlier
 * version of this doc comment claimed otherwise and always reset to page
 * 1 for that reason -- that reasoning didn't hold up: it conflated "the
 * PRODUCTS on page N change" with "page N might not exist", but only the
 * former is true. Found and corrected after the user reported it read as
 * a bug that the Sort By/direction controls always dropped them back to
 * page 1 while browsing page 2+.)
 */
export function sortHref(basePath: string, key: SortKey, dir: SortDir, pageNum: number = 1): string {
  const clean = basePath.replace(/\/+$/, '');
  const slug = sortRouteSlug(key, dir);
  const pageSegment = pageNum > 1 ? `${pageNum}/` : '';
  return slug ? `${clean}/${slug}/${pageSegment}` : `${clean}/${pageSegment}`;
}
