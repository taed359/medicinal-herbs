/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /**
     * Set by src/middleware.ts once a request to a protected /admin/* or
     * /api/admin/* route has passed session validation. Undefined on
     * public routes (the storefront, /admin/login).
     */
    adminUser?: {
      id: string;
      name: string;
      email: string;
    };

    /**
     * Set by src/middleware.ts for every request under /customer/* once
     * the customer Better Auth session has been resolved (undefined if
     * there is no valid session -- most /customer/* pages are public,
     * this is not itself an auth gate). Value originates ONLY from
     * customerAuth.api.getSession's verified result -- never trust a
     * customer identity from body/query/path for authorization.
     */
    customerUser?: {
      id: string;
      name: string;
      email: string;
      emailVerified: boolean;
    };
  }
}
