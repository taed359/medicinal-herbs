/**
 * POST /api/admin/products -- create a product. Follows the exact
 * session/method/origin protection pattern src/pages/api/admin/health.ts
 * established as the template for every real /api/admin/* mutation route
 * (session check already ran in src/middleware.ts before this file even
 * runs; this only adds the method allow-list + origin check + the
 * mutation itself).
 */
export const prerender = false;

import type { APIRoute } from 'astro';
import { checkMethod, checkOrigin, jsonError } from '../../../../server/auth/csrf';
import { adminProductRepository } from '../../../../server/repositories/admin';
import { parseAdminProductInput, ValidationError } from '../../../../server/lib/validate-admin-product-input';
import { ImageProbeError } from '../../../../server/lib/probe-image';

export const ALL: APIRoute = async ({ request }) => {
  const methodError = checkMethod(request, ['POST']);
  if (methodError) return methodError;

  const originError = checkOrigin(request);
  if (originError) return originError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'invalid_json');
  }

  let input;
  try {
    input = parseAdminProductInput(body as Record<string, unknown>);
  } catch (err) {
    if (err instanceof ValidationError) return jsonError(400, err.message);
    throw err;
  }

  if (await adminProductRepository.slugExists(input.slug)) {
    return jsonError(409, `Slug "${input.slug}" is already used by another product.`);
  }

  try {
    const { id } = await adminProductRepository.create(input);
    return new Response(JSON.stringify({ id }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof ImageProbeError) return jsonError(400, err.message);
    // Postgres unique_violation, as a backstop behind the slugExists()
    // pre-check above (e.g. a concurrent request created the same slug
    // between the check and this insert), or a variant-level uniqueness
    // constraint (sku, at-most-one-default) that has no application-level
    // pre-check.
    const uniqueViolationMessage = describeUniqueViolation(err, input.slug);
    if (uniqueViolationMessage) return jsonError(409, uniqueViolationMessage);
    console.error('Failed to create product:', err);
    return jsonError(500, 'Failed to create product.');
  }
};

/** Maps a Postgres unique_violation to an operator-facing message keyed
 *  off which constraint actually fired -- `err.constraint` is the real
 *  constraint/index name node-postgres attaches to the error, so a SKU
 *  collision is never misreported as a slug collision (or vice versa).
 *  Returns null for anything that isn't a unique_violation. */
function describeUniqueViolation(err: unknown, slug: string): string | null {
  if (typeof err !== 'object' || err === null || (err as { code?: unknown }).code !== '23505') return null;
  const constraint = (err as { constraint?: unknown }).constraint;
  if (constraint === 'product_variants_sku_unique') {
    return 'That SKU is already used by another variant.';
  }
  if (constraint === 'idx_variants_one_default') {
    return 'Only one variant can be marked as the default.';
  }
  return `Slug "${slug}" is already used by another product.`;
}
