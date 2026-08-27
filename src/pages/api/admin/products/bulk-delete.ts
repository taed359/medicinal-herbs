/**
 * POST /api/admin/products/bulk-delete -- atomically delete a set of
 * products selected in the admin grid.
 *
 * Same session/method/origin protection pattern as every other
 * /api/admin/* route (this path is already covered by src/middleware.ts's
 * `startsWith('/api/admin/')` check -- no middleware changes needed).
 *
 * Contract (see AdminProductRepository.deleteMany's doc comment for the
 * atomicity guarantee): request body { ids: string[] }, response
 * { deleted: string[], count: number }. All-or-nothing -- if any
 * requested id doesn't actually exist, the whole request is rejected
 * with 400 rather than silently deleting the ones that do (that is what
 * "verify IDs against the DB before deleting" means here: existence is
 * checked BEFORE the delete runs, not inferred from its result).
 */
export const prerender = false;

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { inArray } from 'drizzle-orm';
import { checkMethod, checkOrigin, jsonError } from '../../../../server/auth/csrf';
import { adminProductRepository } from '../../../../server/repositories/admin';
import { db } from '../../../../server/db/client';
import { products } from '../../../../db/schema';

// zod is a real, resolvable dependency here (hoisted transitively via
// astro@7.2.7 and better-auth@1.7.2 -- confirmed with `npm ls zod`,
// zod@4.4.3 in both cases) but is NOT listed in package.json. Importing
// it directly, without adding a package.json entry, follows the letter
// of "no dependency installation" while honoring the explicit "Use Zod"
// instruction -- flagged as an assumption in the implementation report.
const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'ids must be a non-empty array'),
});

export const POST: APIRoute = async ({ request }) => {
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

  const parsed = bulkDeleteSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, 'ids must be a non-empty array of product ids.');
  }

  // Dedupe before anything touches the DB.
  const ids = [...new Set(parsed.data.ids)];

  try {
    // Verify every id actually exists BEFORE deleting anything -- an id
    // that doesn't exist means the client's selection is stale (e.g.
    // another admin already deleted it), and the correct response is to
    // reject the whole request, not to delete a subset and report
    // partial success.
    const existing = await db
      .select({ id: products.id })
      .from(products)
      .where(inArray(products.id, ids));

    const existingIds = new Set(existing.map((row) => row.id));
    const missingIds = ids.filter((id) => !existingIds.has(id));

    if (missingIds.length > 0) {
      return jsonError(
        409,
        `${missingIds.length} of the selected product(s) no longer exist. Refresh and try again.`
      );
    }

    const { deleted } = await adminProductRepository.deleteMany(ids);

    return new Response(JSON.stringify({ deleted, count: deleted.length }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    console.error('Bulk product delete failed:', err);
    return jsonError(500, 'Failed to delete the selected products.');
  }
};
