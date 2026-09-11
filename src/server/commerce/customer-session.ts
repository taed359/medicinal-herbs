/**
 * Optional customer session lookup for cart/checkout API routes.
 *
 * Deliberately NOT the same strict handling as src/middleware.ts's
 * customer-page gate (which turns a session-lookup failure into a 503 —
 * correct there, because it protects pages whose whole point is showing
 * account state). A cart/checkout request must never hard-fail just
 * because the session lookup had a blip: worst case, a signed-in visitor
 * is treated as a guest for that one request (cart still works — see
 * cart-service.ts's mergeCartOnLogin for how a guest cart later attaches
 * to the account anyway). Returns null on "no session" AND on lookup
 * failure alike; callers that truly need to require sign-in (none do yet
 * — checkout supports guests) would need a stricter check of their own.
 */
import { customerAuth } from '../auth/customer-auth';

export interface OptionalCustomerSession {
  id: string;
  name: string;
  email: string;
}

export async function getOptionalCustomerSession(request: Request): Promise<OptionalCustomerSession | null> {
  try {
    const session = await customerAuth.api.getSession({ headers: request.headers });
    if (!session) return null;
    return { id: session.user.id, name: session.user.name, email: session.user.email };
  } catch {
    return null;
  }
}
