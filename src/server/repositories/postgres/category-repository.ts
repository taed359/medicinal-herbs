import { and, asc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { categories, categoryTranslations } from '../../../db/schema';
import type { CategoryView, Locale } from '../../../domain/types';
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
}

export const categoryRepository: CategoryRepository = new PostgresCategoryRepository();
