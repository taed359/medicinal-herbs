/**
 * Better Auth instance — Phase 1 (Admin Foundation).
 *
 * Runs per-request inside the Node adapter for /admin/*, /api/admin/*, and
 * the catch-all handler at /api/auth/[...all] (see astro.config.mjs). Never
 * imported by a prerendered storefront page.
 *
 * Scope, per the Better Auth audit:
 *   - email/password only, sign-up disabled (single pre-seeded operator
 *     account — see scripts/seed-admin.ts). No social providers, no
 *     magic-link, no OTP, no anonymous-user or username plugins, no
 *     custom registration endpoint.
 *   - Database-backed sessions (Better Auth's default — no JWT plugin),
 *     default 7-day expiration / 1-day rolling refresh, unchanged.
 *   - Custom Argon2id hashing (src/server/auth/argon2.ts) in place of
 *     Better Auth's default Scrypt.
 *   - Our own `admin_`-prefixed tables (src/db/schema.ts), mapped in via
 *     the Drizzle adapter's `schema` option plus explicit
 *     `modelName`/`fields` on each of user/session/account/verification,
 *     rather than letting Better Auth's CLI generate/own the schema.
 *   - No role/RBAC config here — single-operator for this phase; the
 *     middleware (src/middleware.ts) only checks "is there a valid
 *     session", nothing more.
 *   - Built-in rate limiting enabled, with a tightened custom rule for
 *     "/sign-in/email" (5 attempts / 15 min / IP) — see the `rateLimit`
 *     block below for the full reasoning and its documented trade-off.
 *   - No `trustedOrigins` — baseURL's own origin is trusted automatically;
 *     see the comment on `baseURL` below.
 */
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../db/client';
import {
  adminUsers,
  adminSessions,
  adminAccounts,
  adminVerifications,
} from '../../db/schema';
import { hashPassword, verifyPassword } from './argon2';

try {
  process.loadEnvFile();
} catch {
  // .env not present — rely on real environment variables (e.g. CI/host secrets).
}

const authSecret = process.env.BETTER_AUTH_SECRET;
if (!authSecret) {
  throw new Error(
    'BETTER_AUTH_SECRET is not set. Set it in .env (see .env.example) before ' +
    'running the dev server, build, or the admin seed script.'
  );
}

export const auth = betterAuth({
  secret: authSecret,
  // e.g. https://admin.example.com — required in production. No
  // `trustedOrigins` is configured: confirmed by reading better-auth's
  // actual trusted-origin resolution (context/helpers.mjs's
  // getTrustedOrigins) that `baseURL`'s own origin is unconditionally
  // trusted before `trustedOrigins` is even consulted — that option only
  // adds ADDITIONAL origins beyond baseURL (e.g. a separate frontend
  // domain). This project serves the admin UI and its API from the same
  // single origin, so baseURL alone is correct and complete; adding
  // `trustedOrigins: [process.env.BETTER_AUTH_URL]` here would be inert,
  // redundant configuration.
  baseURL: process.env.BETTER_AUTH_URL,

  database: drizzleAdapter(db, {
    provider: 'pg',
    // Keyed by the *resolved* model name, i.e. the `modelName` values set
    // below (not Better Auth's canonical "user"/"session"/"account"/
    // "verification") — the Drizzle adapter looks a table up by whatever
    // model name it's been told to use for that entity.
    schema: {
      admin_users: adminUsers,
      admin_sessions: adminSessions,
      admin_accounts: adminAccounts,
      admin_verifications: adminVerifications,
    },
  }),

  // Explicit modelName/fields mapping per the audit: `modelName` is what
  // points each Better Auth model at our `admin_`-prefixed table (and
  // must match the `schema` keys above exactly). Our column names already
  // match Better Auth's canonical field names 1:1 (see src/db/schema.ts's
  // comment block), so `fields` has nothing left to remap today.
  user: {
    modelName: 'admin_users',
    fields: {},
  },
  session: {
    modelName: 'admin_sessions',
    fields: {},
    // Defaults, unchanged — flagging explicitly per the audit rather than
    // silently relying on them:
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day rolling refresh
  },
  account: {
    modelName: 'admin_accounts',
    fields: {},
  },
  verification: {
    modelName: 'admin_verifications',
    fields: {},
  },

  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    password: {
      hash: hashPassword,
      verify: ({ hash, password }) => verifyPassword(hash, password),
    },
  },

  // No socialProviders, no plugins (no magic-link, no email-otp, no
  // anonymous, no username) — deliberate, per the audit.

  // Rate limiting — confirmed by reading better-auth@1.7.2's actual
  // installed source (api/rate-limiter/index.mjs), not assumed from docs:
  //
  //   - Built in, no extra package. `enabled` defaults to
  //     `NODE_ENV === 'production'` only — set `true` explicitly here so
  //     it's on in every environment this runs in, not conditional on how
  //     NODE_ENV happens to be set on a given host.
  //   - Every request is checked in a single atomic step (read-decide-write
  //     happens together — no separate response-phase write, so concurrent
  //     requests can't all pass a stale read before one increment lands).
  //   - Better Auth already ships a built-in default rule for any path
  //     starting with "/sign-in" (also "/sign-up", "/change-password",
  //     "/change-email"): window 10s, max 3 — a burst throttle, not a
  //     lockout (it fully resets every 10 seconds). `customRules` below
  //     overrides that default specifically for "/sign-in/email" (the
  //     path Better Auth's own signInEmail endpoint is registered at —
  //     see api/routes/sign-in.mjs) with a tighter total-attempt budget
  //     over a longer window, which suits a single admin operator better
  //     than a fast-resetting burst limit: 5 attempts per 15 minutes per
  //     IP+path, keyed the same way Better Auth keys everything else
  //     (client IP, resolved via `advanced.ipAddress`, + the endpoint
  //     path). On the 6th attempt within the window it returns 429 with
  //     an `X-Retry-After` header (seconds), tested live below.
  //   - `storage` intentionally left at its default, "memory": zero extra
  //     schema/migration, and this app runs as a single Node process for
  //     a single low-traffic admin operator. Trade-off, stated explicitly
  //     per the audit: an in-memory counter resets on every process
  //     restart/deploy, and is NOT shared across multiple concurrent
  //     server instances (e.g. horizontally-scaled/multi-replica
  //     hosting) — each instance would enforce the limit independently,
  //     effectively multiplying the real allowed attempt count by the
  //     instance count. If this ever moves to multi-instance hosting,
  //     Better Auth supports `storage: 'database'` (persists counters in
  //     a `rateLimit`-modeled table, shared across instances) or
  //     `storage: 'secondary-storage'` (e.g. Redis) as a drop-in change
  //     here — no code elsewhere depends on which storage is chosen.
  // TODO before real production use: switch storage to 'database' —
  // in-memory rate limiting is unreliable across Vercel's serverless
  // instances and is only acceptable for this demo deployment. Each
  // serverless instance holds its own independent in-memory counter, so
  // the effective limit under Vercel is closer to (5 attempts × however
  // many concurrent instances happen to serve the requests) than a true
  // global 5/15min — accepted, explicit tradeoff for this demo period,
  // not a silent gap.
  rateLimit: {
    enabled: true,
    customRules: {
      '/sign-in/email': { window: 60 * 15, max: 5 }, // 5 attempts / 15 min / IP
    },
  },
});
