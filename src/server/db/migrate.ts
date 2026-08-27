/**
 * Applies pending SQL migrations from ./drizzle/migrations (generated via
 * `npm run db:generate`) to the database at DATABASE_URL. Run this before
 * `npm run db:seed` and before `astro build` on a fresh database.
 *
 * This is a standalone Node script (run via `tsx`), not part of the Astro
 * build itself — migrations are an explicit, deliberate operator action,
 * not something that runs implicitly on every build.
 */
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './client';

async function main() {
  console.log('Applying migrations from ./drizzle/migrations ...');
  await migrate(db, { migrationsFolder: './drizzle/migrations' });
  console.log('Migrations applied successfully.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
