/**
 * PATCH /api/admin/orders/:id -- update an order's status and/or payment
 * status. No DELETE here (unlike the products [id] route) -- an order is
 * a business/accounting record, not draft content; nothing in this admin
 * area should ever be able to erase one.
 *
 * Same session/method/origin protection pattern as every other
 * /api/admin/* route (see src/pages/api/admin/health.ts, the template
 * every one of these follows).
 */
export const prerender = false;

import type { APIRoute } from 'astro';
import { checkMethod, checkOrigin, jsonError } from '../../../../server/auth/csrf';
import { adminOrderRepository } from '../../../../server/repositories/admin';
import { parseAdminOrderStatusUpdateInput } from '../../../../server/lib/validate-admin-order-status-input';
import { ValidationError } from '../../../../server/lib/validate-admin-product-input';

export const ALL: APIRoute = async ({ request, params }) => {
  const methodError = checkMethod(request, ['PATCH']);
  if (methodError) return methodError;

  const originError = checkOrigin(request);
  if (originError) return originError;

  const id = params.id;
  if (!id) return jsonError(400, 'missing_id');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'invalid_json');
  }

  let input;
  try {
    input = parseAdminOrderStatusUpdateInput(body as Record<string, unknown>);
  } catch (err) {
    if (err instanceof ValidationError) return jsonError(400, err.message);
    throw err;
  }

  try {
    await adminOrderRepository.updateStatus(id, input);
    return new Response(JSON.stringify({ id }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('not found')) {
      return jsonError(404, 'Order not found.');
    }
    console.error(`Failed to update order "${id}":`, err);
    return jsonError(500, 'Failed to update order.');
  }
};
