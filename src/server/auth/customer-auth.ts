/**
 * Customer-facing Better Auth instance — Phase 1 (Customer Authentication).
 *
 * A SECOND, fully independent instance from src/server/auth/auth.ts (the
 * admin one). Never shares a table, a cookie, or a code path with it —
 * see src/db/schema.ts's customer_* tables doc comment for why this is a
 * deliberate security boundary, not duplication. Same library, same
 * Argon2id helper, same Drizzle adapter pattern, same shared `db`
 * connection pool as admin — only the model mapping and a few behavioral
 * options differ.
 *
 * DEVIATION FROM THE ORIGINAL BRIEF, DOCUMENTED HERE:
 * The brief's config list says `requireEmailVerification: true`. Verified
 * directly against the installed better-auth@1.7.2 source
 * (dist/api/routes/sign-up.mjs's `shouldSkipAutoSignIn` /
 * `shouldReturnGenericDuplicateResponse` logic): that flag does two things
 * neither of which match the brief's own Phase 1 UX requirement --
 *   1. It skips auto-sign-in on registration entirely (no session created),
 *   2. It blocks EVERY subsequent sign-in for an unverified account.
 * The brief's flow section explicitly requires the opposite: "session may
 * be established immediately... user can browse... user can use cart...
 * do not make the entire storefront unusable until verification." Setting
 * `requireEmailVerification: true` would directly contradict that.
 * Resolution used instead (both real, documented options, verified in
 * @better-auth/core's init-options.d.mts): `requireEmailVerification:
 * false` (default) + `emailVerification.sendOnSignUp: true` -- this sends
 * the verification email and creates emailVerified:false on sign-up
 * *without* blocking session creation or later sign-ins. The actual
 * verification gate belongs at the application layer (the checkout/order
 * mutation route checking `session.user.emailVerified` directly), exactly
 * as the brief's own §19 requires.
 */
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createAuthMiddleware, APIError } from 'better-auth/api';
import { sql, eq } from 'drizzle-orm';
import { db } from '../db/client';
import {
  customerUsers,
  customerSessions,
  customerAccounts,
  customerVerifications,
  customerProfiles,
  rateLimit,
  customerLoginAttempts,
} from '../../db/schema';
import { hashPassword, verifyPassword } from './argon2';
import { sendCustomerVerificationEmail, sendCustomerPasswordResetEmail } from '../email/customer-email';
import type { Locale } from '../../i18n/utils';

/** The ONLY place an untrusted, client-supplied locale value is validated
 *  down to exactly 'vi' | 'zh' (no English auth UI -- see the customer
 *  auth i18n work) before it's trusted anywhere else in this file or
 *  passed into customer-email.ts. Anything else -- missing, malformed,
 *  'en', or an arbitrary string -- silently becomes 'vi'; this never
 *  throws, since a bad locale value must never fail registration. */
function toSupportedLocale(value: unknown): Locale {
  return value === 'vi' || value === 'zh' ? value : 'vi';
}

/** Reads the customer's stored locale preference (src/db/schema.ts's
 *  customer_profiles.locale, defaulted + check-constrained to 'vi' | 'zh'
 *  at the DB layer already) -- used for password-reset emails, which must
 *  use the locale the customer registered with, never a client-supplied
 *  value at reset-request time (there is no reliable "current UI locale"
 *  at that point anyway: the forgot-password page's own `?lang=` reflects
 *  whatever language the *visitor* currently has it open in, which may not
 *  be the account owner). Falls back to 'vi' if the row is somehow missing
 *  (should not happen -- the profile is created eagerly at signup, see
 *  databaseHooks.user.create.after below) rather than throwing. */
async function getCustomerLocale(customerId: string): Promise<Locale> {
  const [profile] = await db
    .select({ locale: customerProfiles.locale })
    .from(customerProfiles)
    .where(eq(customerProfiles.customerId, customerId));
  return toSupportedLocale(profile?.locale);
}

/** Registration is the one point where a client-supplied locale is
 *  trusted (validated) and persisted: the register.astro page already
 *  resolves its own `?lang=` down to 'vi' | 'zh' server-side and sends it
 *  as a plain `locale` field in the sign-up JSON body -- NOT a Better Auth
 *  `user.additionalFields` (that would write to customer_users, which must
 *  stay entirely Better-Auth-owned; see customer_profiles's doc comment in
 *  src/db/schema.ts). Better Auth's own sign-up endpoint has no concept of
 *  this field, so it's read directly off the raw request here, the same
 *  way Better Auth itself passes a cloned Request into this exact hook for
 *  exactly this kind of use (verified in the installed
 *  better-auth@1.7.2 source: dist/api/routes/sign-up.mjs calls
 *  `sendVerificationEmail({user, url, token}, safeCloneRequest(ctx.request))`
 *  -- a fresh, never-yet-read clone, safe to call .json() on once here).
 *  Never trusted beyond `toSupportedLocale`'s strict vi/zh allow-list.
 *
 *  UPSERT, not a plain UPDATE: verified directly against the installed
 *  better-auth@1.7.2 source (dist/db/with-hooks.mjs's `createWithHooks`)
 *  that `databaseHooks.user.create.after` (below, the hook that inserts
 *  this same customer_profiles row) runs via `queueAfterTransactionHook`
 *  -- deferred, NOT awaited inline before `createUser()` returns. This
 *  hook (sendVerificationEmail) reliably fires AFTER createUser() returns
 *  but there is no guarantee it fires after the queued after-hook's INSERT
 *  has actually run -- empirically, it usually runs first. A plain UPDATE
 *  would then silently affect zero rows (the profile doesn't exist yet),
 *  leaving locale stuck on the column default. INSERT ... ON CONFLICT DO
 *  UPDATE is correct regardless of which of the two writes lands first. */
async function resolveAndPersistRegistrationLocale(customerId: string, request: Request | undefined): Promise<Locale> {
  let requestedLocale: unknown;
  if (request) {
    try {
      const body: unknown = await request.json();
      requestedLocale = body && typeof body === 'object' ? (body as { locale?: unknown }).locale : undefined;
    } catch {
      // Missing/unreadable/malformed body -- fall through to the 'vi'
      // default below; a bad locale value must never fail registration.
    }
  }
  const locale = toSupportedLocale(requestedLocale);
  await db
    .insert(customerProfiles)
    .values({ customerId, locale })
    .onConflictDoUpdate({ target: customerProfiles.customerId, set: { locale, updatedAt: new Date() } });
  return locale;
}

try {
  process.loadEnvFile();
} catch {
  // .env not present -- rely on a real environment variable (CI/host secrets).
}

const authSecret = process.env.BETTER_AUTH_SECRET;
if (!authSecret) {
  throw new Error(
    'BETTER_AUTH_SECRET is not set. Set it in .env before running the dev server, build, or ' +
    'the customer auth routes. Shared with the admin Better Auth instance -- separate cookies/' +
    'tables already provide isolation, so a second secret is not required.'
  );
}

// --- Per-account (email) sign-in limiter --------------------------------
// Better Auth's own `rateLimit.customRules` can only adjust the window/max
// of its existing IP+path bucket (verified against the installed
// rate-limiter source) -- it cannot key by anything else. This is a
// separate, application-owned check (customer_login_attempts, defined in
// src/db/schema.ts -- NOT Better Auth's own `rateLimit` model/table) run
// via the real, documented `hooks.before` extension point, before Argon2id
// verification ever runs. Defense-in-depth alongside the IP+path limiter
// below, and the primary control given the IP-trust caveat documented on
// that limiter's config.
const LOGIN_ATTEMPT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const LOGIN_ATTEMPT_MAX = 10;

/** Single atomic INSERT ... ON CONFLICT DO UPDATE -- no JS read-then-write.
 *  Postgres takes a row-level lock on the conflicting `email` row before
 *  evaluating the SET expressions, so concurrent requests for the same
 *  email serialize on this one statement instead of racing on a
 *  read-modify-write round trip (verified this was a real, exploitable
 *  lost-update race in the previous implementation -- concurrent bursts
 *  let far more than LOGIN_ATTEMPT_MAX real attempts through). The
 *  reset-vs-increment decision and the write happen in the same
 *  statement Postgres executes atomically; `${customerLoginAttempts.*}`
 *  inside the `sql` fragments refers to the pre-existing (target) row,
 *  the standard Postgres upsert idiom -- never `excluded.*`, which would
 *  mean "the row that would have been inserted" instead. */
async function checkAndRecordLoginAttempt(email: string): Promise<void> {
  const windowSeconds = LOGIN_ATTEMPT_WINDOW_MS / 1000;
  const windowExpired = sql`${customerLoginAttempts.windowStartedAt} < now() - (interval '1 second' * ${windowSeconds})`;

  const [row] = await db
    .insert(customerLoginAttempts)
    .values({ email, count: 1 })
    .onConflictDoUpdate({
      target: customerLoginAttempts.email,
      set: {
        count: sql`case when ${windowExpired} then 1 else ${customerLoginAttempts.count} + 1 end`,
        windowStartedAt: sql`case when ${windowExpired} then now() else ${customerLoginAttempts.windowStartedAt} end`,
      },
    })
    .returning({ count: customerLoginAttempts.count });

  if (row.count > LOGIN_ATTEMPT_MAX) {
    throw new APIError('TOO_MANY_REQUESTS', {
      message: 'Too many sign-in attempts for this account. Please try again later.',
    });
  }
}

export const customerAuth = betterAuth({
  secret: authSecret,
  baseURL: process.env.BETTER_AUTH_URL,
  // Better Auth's own routes are mounted at baseURL + basePath -- must
  // match the catch-all route below (src/pages/api/customer-auth/
  // [...all].ts) so links Better Auth builds itself (verification/reset
  // emails) point at the right path. Admin implicitly uses the default
  // "/api/auth", matching its own catch-all.
  basePath: '/api/customer-auth',

  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      customer_users: customerUsers,
      customer_sessions: customerSessions,
      customer_accounts: customerAccounts,
      customer_verifications: customerVerifications,
      rateLimit,
    },
  }),

  user: { modelName: 'customer_users', fields: {} },
  session: {
    modelName: 'customer_sessions',
    fields: {},
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // 1 day rolling refresh
  },
  account: { modelName: 'customer_accounts', fields: {} },
  verification: { modelName: 'customer_verifications', fields: {} },

  // Only the cookie prefix is set -- no domain/path/secure/httpOnly/
  // sameSite overrides. Better Auth computes those correctly on its own
  // (Secure when baseURL is https, HttpOnly, SameSite=Lax, host-only,
  // Path=/ -- same defaults already proven correct for the admin cookie).
  advanced: { cookiePrefix: 'customer-auth' },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // see the file-level doc comment above
    minPasswordLength: 12,
    password: {
      hash: hashPassword,
      verify: ({ hash, password }) => verifyPassword(hash, password),
    },
    sendResetPassword: async ({ user, token }) => {
      // Stored profile locale, NEVER a client-supplied value at reset
      // time -- see getCustomerLocale's own doc comment above for why.
      const locale = await getCustomerLocale(user.id);
      const url = `${process.env.BETTER_AUTH_URL}/customer/reset-password?token=${encodeURIComponent(token)}`;
      await sendCustomerPasswordResetEmail(user.email, url, locale);
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, token }, request) => {
      const locale = await resolveAndPersistRegistrationLocale(user.id, request);
      const url = `${process.env.BETTER_AUTH_URL}/customer/verify-email?token=${encodeURIComponent(token)}`;
      await sendCustomerVerificationEmail(user.email, url, locale);
    },
  },

  // Database-backed, not in-memory -- correct under multiple Vercel
  // instances (verified: any non-'memory'/'secondary-storage' value routes
  // through Better Auth's real createDatabaseStorageWrapper, backed by the
  // `rateLimit` table mapped above). IP trust is intentionally left at
  // Better Auth's default (no `advanced.ipAddress.trustedProxies`) -- see
  // the file-level note: this project cannot yet empirically confirm
  // Vercel's exact x-forwarded-for shape from this environment, so the
  // per-email limiter above is the primary anti-brute-force control, this
  // is defense-in-depth.
  rateLimit: {
    enabled: true,
    storage: 'database',
    customRules: {
      '/sign-in/email': { window: 60 * 15, max: 10 },
    },
  },

  databaseHooks: {
    user: {
      create: {
        // Eagerly creates the 1:1 customer_profiles row for every new
        // customer so no backfill migration is ever needed once a real
        // profile field exists (see customer_profiles's doc comment in
        // src/db/schema.ts). Auth-owned data (customer_users) and
        // business/profile data stay in physically separate tables from
        // the moment an account exists.
        after: async (user) => {
          await db.insert(customerProfiles).values({ customerId: user.id }).onConflictDoNothing();
        },
      },
    },
  },

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (!ctx.request) return;
      const pathname = new URL(ctx.request.url).pathname;
      if (!pathname.endsWith('/sign-in/email')) return;

      const email = ctx.body?.email;
      if (typeof email !== 'string' || email.length === 0) return;

      await checkAndRecordLoginAttempt(email.toLowerCase().trim());
    }),
  },
});
