/**
 * Validates the body of PATCH /api/admin/orders/:id. Reuses the same
 * ValidationError class validate-admin-product-input.ts already exports
 * (rather than declaring a second, identical class) -- both routes'
 * error responses go through the same `jsonError`/`ValidationError`
 * handling in their API route, so there's no reason for two classes with
 * identical behavior.
 */
import { ValidationError } from './validate-admin-product-input';
import { ADMIN_ORDER_STATUSES, ADMIN_ORDER_PAYMENT_STATUSES } from '../../domain/admin-order-types';
import type { AdminOrderStatusUpdateInput } from '../../domain/admin-order-types';

const STATUS_SET = new Set<string>(ADMIN_ORDER_STATUSES);
const PAYMENT_STATUS_SET = new Set<string>(ADMIN_ORDER_PAYMENT_STATUSES);

/** `body` is whatever `await request.json()` produced -- entirely
 *  untrusted. Both fields are optional (see AdminOrderStatusUpdateInput's
 *  doc comment: omitted means "leave unchanged"), but if present, each
 *  must be one of the DB's own allowed values -- never passed through as
 *  a raw string, same discipline as parseAdminProductInput. Throws
 *  ValidationError with a caller-facing message on anything else. */
export function parseAdminOrderStatusUpdateInput(body: Record<string, unknown>): AdminOrderStatusUpdateInput {
  const result: AdminOrderStatusUpdateInput = {};

  if ('status' in body && body.status !== undefined) {
    if (typeof body.status !== 'string' || !STATUS_SET.has(body.status)) {
      throw new ValidationError(`"status" must be one of: ${ADMIN_ORDER_STATUSES.join(', ')}.`);
    }
    result.status = body.status as AdminOrderStatusUpdateInput['status'];
  }

  if ('paymentStatus' in body && body.paymentStatus !== undefined) {
    if (typeof body.paymentStatus !== 'string' || !PAYMENT_STATUS_SET.has(body.paymentStatus)) {
      throw new ValidationError(`"paymentStatus" must be one of: ${ADMIN_ORDER_PAYMENT_STATUSES.join(', ')}.`);
    }
    result.paymentStatus = body.paymentStatus as AdminOrderStatusUpdateInput['paymentStatus'];
  }

  if (result.status === undefined && result.paymentStatus === undefined) {
    throw new ValidationError('Provide at least one of "status" or "paymentStatus".');
  }

  return result;
}
