/**
 * Standalone CLI to bootstrap the single admin operator account.
 *
 * NOT an Astro route and never exposed over HTTP — this only ever runs as
 * a one-off `tsx` process on someone's machine or in a deploy/init step.
 * There is deliberately no web-facing registration endpoint anywhere in
 * this codebase (sign-up is disabled in Better Auth's config too — see
 * src/server/auth/auth.ts).
 *
 * Usage:
 *   npm run seed:admin
 *
 * Reads ADMIN_EMAIL / ADMIN_NAME / ADMIN_PASSWORD from the environment
 * (e.g. a one-off `ADMIN_EMAIL=... ADMIN_NAME=... ADMIN_PASSWORD=... npm
 * run seed:admin`, or a CI secret injection) and prompts interactively —
 * with masked input for the password — for whichever of those three is
 * not already set. Nothing is hardcoded and nothing is committed; .env is
 * NOT read for these three values on purpose (a real operator password
 * has no business sitting in a dotfile on disk).
 *
 * Refuses to run if an admin_users row already exists — this script only
 * ever bootstraps the first operator account. Rotate credentials for an
 * existing operator through a future Phase-2+ flow, not by re-running
 * this script.
 *
 * The password is hashed with the exact same Argon2id helper Better Auth
 * itself is configured with (src/server/auth/argon2.ts), and both the
 * admin_users row and its linked admin_accounts row (providerId:
 * "credential", issuer: "local:credential", accountId set to the new
 * user's own id — Better Auth's own convention for the credential
 * provider, see api/routes/sign-up.mjs) are inserted in a single
 * transaction, so a crash between the two inserts can never leave a user
 * with no way to sign in (or an orphaned credential with no user).
 *
 * Never logs the plaintext password or the resulting hash, at any point.
 */
import { randomUUID } from 'node:crypto';
import readline from 'node:readline';
import { db } from '../src/server/db/client';
import { adminUsers, adminAccounts } from '../src/db/schema';
import { hashPassword } from '../src/server/auth/argon2';

function promptVisible(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(question);

    let value = '';
    const wasRaw = stdin.isRaw;
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    const onData = (chunk: string) => {
      const char = chunk.toString();
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004': // Ctrl-D
          if (stdin.isTTY) stdin.setRawMode(Boolean(wasRaw));
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(value.trim());
          break;
        case '\u0003': // Ctrl-C
          process.stdout.write('\n');
          process.exit(130);
          break;
        case '\u007f': // backspace
        case '\b':
          value = value.slice(0, -1);
          break;
        default:
          value += char;
          break;
      }
    };
    stdin.on('data', onData);
  });
}

async function main() {
  const existing = await db.select({ id: adminUsers.id }).from(adminUsers).limit(1);
  if (existing.length > 0) {
    console.error(
      'Refusing to run: an admin_users row already exists. This script only ' +
      'bootstraps the very first operator account.'
    );
    process.exit(1);
  }

  const email = process.env.ADMIN_EMAIL ?? (await promptVisible('Admin email: '));
  const name = process.env.ADMIN_NAME ?? (await promptVisible('Admin name: '));
  const password = process.env.ADMIN_PASSWORD ?? (await promptHidden('Admin password: '));

  if (!email || !name || !password) {
    console.error('Email, name, and password are all required.');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  const passwordHash = await hashPassword(password); // not logged, ever

  const userId = randomUUID();
  const accountRowId = randomUUID();
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(adminUsers).values({
      id: userId,
      name,
      email,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });

    await tx.insert(adminAccounts).values({
      id: accountRowId,
      userId,
      issuer: 'local:credential',
      accountId: userId, // Better Auth's credential-provider convention: accountId === user id
      providerId: 'credential',
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    });
  });

  console.log(`Admin account created for ${email}. You can now sign in at /admin/login.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Admin seed failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
