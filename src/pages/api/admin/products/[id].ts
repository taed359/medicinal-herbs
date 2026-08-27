/**
 * PATCH /api/admin/products/:id -- update a product.
 * DELETE /api/admin/products/:id -- delete a product (cascades to every
 * child table -- see AdminProductRepository.delete's doc comment).
 *
 * Same session/method/origin protection pattern as index.ts and
 * src/pages/api/admin/health.ts.
 */
export const prerender = false;

import type { APIRoute } from 'astro';
import { checkMethod, checkOrigin, jsonError } from '../../../../server/auth/csrf';
import { adminProductRepository } from '../../../../server/repositories/admin';
import { parseAdminProductInput, ValidationError } from '../../../../server/lib/validate-admin-product-input';
import { ImageProbeError } from '../../../../server/lib/probe-image';

export const ALL: APIRoute = async ({ request, params }) => {
  const methodError = checkMethod(request, ['PATCH', 'DELETE']);
  if (methodError) return methodError;

  const originError = checkOrigin(request);
  if (originError) return originError;

  const id = params.id;
  if (!id) return jsonError(400, 'missing_id');

  if (request.method === 'DELETE') {
    try {
      await adminProductRepository.delete(id);
      return new Response(null, { status: 204 });
    } catch (err) {
      console.error(`Failed to delete product "${id}":`, err);
      return jsonError(500, 'Failed to delete product.');
    }
  }

  // PATCH from here on.
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

  if (await adminProductRepository.slugExists(input.slug, id)) {
    return jsonError(409, `Slug "${input.slug}" is already used by another product.`);
  }

  try {
    await adminProductRepository.update(id, input);
    return new Response(JSON.stringify({ id }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof ImageProbeError) return jsonError(400, err.message);
    const uniqueViolationMessage = describeUniqueViolation(err, input.slug);
    if (uniqueViolationMessage) return jsonError(409, uniqueViolationMessage);
    if (err instanceof Error && err.message.includes('not found')) {
      return jsonError(404, 'Product not found.');
    }
    console.error(`Failed to update product "${id}":`, err);
    return jsonError(500, 'Failed to update product.');
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
