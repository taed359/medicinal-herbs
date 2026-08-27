/**
 * Single import point for admin pages/routes: `import { adminProductRepository }
 * from '../../../server/repositories/admin'`. Mirrors
 * src/server/repositories/index.ts's own reasoning -- one place wires the
 * interface to its Postgres implementation, so admin pages/routes only
 * ever depend on the interface in ./types.ts.
 */
export type { AdminProductRepository } from './types';
export { adminProductRepository } from './postgres/admin-product-repository';
