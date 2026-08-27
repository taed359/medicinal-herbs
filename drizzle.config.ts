import { defineConfig } from 'drizzle-kit';

// Loads DATABASE_URL from .env for the drizzle-kit CLI (generate/migrate
// tooling), independent of Astro's own env loading. See .env.example.
try {
  process.loadEnvFile();
} catch {
  // .env not present — rely on a real environment variable instead.
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env and set a PostgreSQL connection string.'
  );
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
