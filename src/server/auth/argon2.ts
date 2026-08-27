/**
 * Argon2id password hashing — the exact configuration specified in the
 * Better Auth audit, used both by Better Auth's own `emailAndPassword`
 * config (src/server/auth/auth.ts) and by the standalone admin-seed CLI
 * (scripts/seed-admin.ts), so every password in `admin_accounts.password`
 * is hashed identically regardless of which code path wrote it.
 *
 * Explicitly NOT Better Auth's default (Scrypt) — @node-rs/argon2 is used
 * directly instead.
 */
import { hash, verify } from '@node-rs/argon2';

// `Algorithm` is an ambient const enum in @node-rs/argon2's type
// definitions, which can't be imported as a value under this project's
// `verbatimModuleSyntax` TS setting — so the numeric value is used
// directly. `2` is Argon2id (`Algorithm.Argon2id`) in @node-rs/argon2;
// see its index.d.ts: Argon2d = 0, Argon2i = 1, Argon2id = 2.
const ARGON2_OPTIONS = {
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
  outputLen: 32,
  algorithm: 2, // Argon2id
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hashed: string, password: string): Promise<boolean> {
  return verify(hashed, password, ARGON2_OPTIONS);
}
