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
  }
}
