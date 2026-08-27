/**
 * Shared Postgres connection (Drizzle + node-postgres pool). Never imported
 * by client-side code.
 *
 * Two distinct runtime lifetimes use this same module:
 *   - Storefront pages (src/pages/**\/*.astro, no `prerender = false`) and
 *     the migrate/seed/tsx scripts: read this only inside the Node process
 *     that runs `astro build` (or the script itself) — build-time only.
 *   - /admin/*, /api/admin/*, and /api/auth/[...all] (each explicitly
 *     `export const prerender = false` — see astro.config.mjs, which adds
 *     the `@astrojs/vercel` adapter for exactly these routes while the
 *     project-level `output` stays 'static'): these run per-request as
 *     Vercel serverless functions, so this pool is instantiated fresh
 *     (cold start) or reused (warm invocation) per function instance —
 *     see the Neon/serverless notes below.
 *
 * DRIVER CHOICE FOR NEON (demo deployment) — researched, not assumed:
 * Drizzle's own docs point to `drizzle-orm/neon-http` (HTTP, via
 * @neondatabase/serverless's `neon()`) as the default recommendation for
 * serverless functions. That was deliberately NOT adopted here, for a
 * concrete, verified reason: reading drizzle-orm's own installed source
 * (neon-http/session.js) shows `db.transaction()` unconditionally throws
 * `"No transactions support in neon-http driver"` — and this codebase
 * genuinely needs transactions (scripts/seed-admin.ts inserts admin_users
 * + admin_accounts atomically; Phase 2 product-write routes will need the
 * same guarantee).
 *
 * The WebSocket alternative, `drizzle-orm/neon-serverless` (Neon's own
 * `Pool`), DOES support real transactions — but only by connecting
 * through Neon's own WebSocket proxy. Per Neon's own docs, it cannot talk
 * to a plain, non-Neon Postgres instance at all without also running a
 * separate local Neon-proxy Docker container. Adopting it would silently
 * break every local/CI validation path this project already relies on
 * (this repo's own device/cloud validation workflow, and anyone's local
 * Postgres) for a single-operator, low-traffic admin demo that doesn't
 * need edge-latency query performance.
 *
 * So: `pg` + `drizzle-orm/node-postgres` stays exactly as it was — this
 * file's connection code is UNCHANGED from the pre-Vercel setup. What
 * changes is operational, not code: on Vercel, `DATABASE_URL` must be
 * Neon's *pooled* connection string (hostname contains `-pooler` — copy
 * it from the Neon dashboard's "Pooled connection" toggle), not the
 * direct one. Neon's pooled string runs through their own PgBouncer-style
 * pooler specifically for "many short-lived connections" workloads like
 * serverless functions, and it's fully wire-compatible with any standard
 * Postgres client — no driver change required. (One documented
 * consequence of pooled/transaction-mode connections: session-level
 * `SET`/`RESET` and `PREPARE`/`DEALLOCATE` aren't supported. Nothing in
 * this codebase issues those — Drizzle's queries use the extended
 * protocol's own parameterization, not raw SET/PREPARE statements — so
 * this doesn't affect us.)
 *
 * `Pool`'s `max` is kept small when actually running on Vercel
 * (`process.env.VERCEL` is a platform-provided env var, set automatically
 * in every Vercel build and runtime — not something this project sets).
 * This is a conservative, widely-used practice for a `pg.Pool` inside a
 * serverless function, not a documented Neon requirement: many concurrent
 * function invocations can each hold their own pool, and a small
 * per-instance cap plus a short idle timeout keeps the total connection
 * count against the pooled endpoint bounded. Local dev, `astro build`,
 * and the migrate/seed scripts are unaffected — they keep pg's normal
 * default pool sizing.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../../db/schema';

try {
  process.loadEnvFile();
} catch {
  // .env not present — rely on a real environment variable (e.g. CI secret,
  // or Vercel's dashboard-configured environment variables).
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env and set a PostgreSQL ' +
    'connection string before running the build, db:migrate, or db:seed.'
  );
}

const runningOnVercel = process.env.VERCEL === '1';

const pool = new Pool({
  connectionString,
  ...(runningOnVercel
    ? {
        max: 1, // one connection per function instance — see comment above
        idleTimeoutMillis: 10_000,
      }
    : {}),
});

export const db = drizzle(pool, { schema });
