import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { categories, categoryTranslations, products } from '../../../db/schema';
import type { CategoryView, CategoryWithCountView, Locale } from '../../../domain/types';
import type { CategoryRepository } from '../types';

class PostgresCategoryRepository implements CategoryRepository {
  async getBySlug(slug: string, locale: Locale): Promise<CategoryView | null> {
    const [row] = await db
      .select({
        id: categories.id,
        slug: categories.slug,
        name: categoryTranslations.name,
        description: categoryTranslations.description,
      })
      .from(categories)
      .innerJoin(
        categoryTranslations,
        and(eq(categoryTranslations.categoryId, categories.id), eq(categoryTranslations.locale, locale))
      )
      .where(and(eq(categories.slug, slug), eq(categories.isPublished, true)))
      .limit(1);

    if (!row) return null;
    return { id: row.id, slug: row.slug, locale, name: row.name, description: row.description };
  }

  async listPublished(locale: Locale): Promise<CategoryView[]> {
    const rows = await db
      .select({
        id: categories.id,
        slug: categories.slug,
        name: categoryTranslations.name,
        description: categoryTranslations.description,
      })
      .from(categories)
      .innerJoin(
        categoryTranslations,
        and(eq(categoryTranslations.categoryId, categories.id), eq(categoryTranslations.locale, locale))
      )
      .where(eq(categories.isPublished, true))
      .orderBy(asc(categories.sortOrder));

    return rows.map((row) => ({ id: row.id, slug: row.slug, locale, name: row.name, description: row.description }));
  }

  async listPublishedWithCounts(locale: Locale): Promise<CategoryWithCountView[]> {
    // LEFT JOIN + COUNT(...) FILTER so a category with zero published
    // products still gets a row (count 0) instead of disappearing --
    // an INNER JOIN here would silently hide any newly-created,
    // not-yet-stocked category from the filter sidebar.
    const rows = await db
      .select({
        id: categories.id,
        slug: categories.slug,
        name: categoryTranslations.name,
        description: categoryTranslations.description,
        productCount: sql<number>`count(${products.id}) filter (where ${products.isPublished} = true)::int`,
      })
      .from(categories)
      .innerJoin(
        categoryTranslations,
        and(eq(categoryTranslations.categoryId, categories.id), eq(categoryTranslations.locale, locale))
      )
      .leftJoin(products, eq(products.categoryId, categories.id))
      .where(eq(categories.isPublished, true))
      .groupBy(categories.id, categories.slug, categories.sortOrder, categoryTranslations.name, categoryTranslations.description)
      .orderBy(asc(categories.sortOrder));

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      locale,
      name: row.name,
      description: row.description,
      productCount: row.productCount,
    }));
  }
}

export const categoryRepository: CategoryRepository = new PostgresCategoryRepository();
