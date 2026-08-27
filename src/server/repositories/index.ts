/**
 * Single import point for Astro pages: `import { productRepository,
 * categoryRepository } from '../../../server/repositories'`. Pages depend
 * only on the interfaces (src/server/repositories/types.ts); this file is
 * the one place that wires them to the concrete Postgres implementation,
 * so swapping providers later touches one file, not every page.
 */
export type { ProductRepository, CategoryRepository } from './types';
export { productRepository } from './postgres/product-repository';
export { categoryRepository } from './postgres/category-repository';
