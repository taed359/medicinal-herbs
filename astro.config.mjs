// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

// https://astro.build/config
//
// `output: 'static'` is explicit (it's also the default) — the storefront
// (/, /products/*, /vi/*, /zh/*, etc.) is prerendered at build time as
// before; nothing about those routes changes. The `vercel` adapter is
// added only so that the small set of routes that opt out via
// `export const prerender = false` (the /admin/* pages, /api/admin/*, and
// the Better Auth catch-all at /api/auth/[...all]) have a server runtime
// to actually run on — Astro's hybrid rendering requires an adapter for
// any on-demand route even when the project-level output stays 'static'.
// This does NOT switch the project to `output: 'server'`.
//
// Swapped from @astrojs/node (used for local/VPS-style testing) to
// @astrojs/vercel for the demo deployment on Vercel. `astro build` with
// this adapter writes directly to `.vercel/output/` (Vercel's Build
// Output API format: static assets + serverless functions) instead of a
// generic `dist/` — no `vercel build` wrapper needed, `npm run build`
// (`astro build`) alone produces a deployable Vercel output. Default
// options are used: `middlewareMode` defaults to 'classic', meaning
// src/middleware.ts runs at request time for the on-demand /admin/* and
// /api/admin/* routes (as a normal Vercel serverless function) and is a
// no-op build-time pass-through for the prerendered storefront pages —
// not deployed as separate Vercel Edge Middleware.
export default defineConfig({
  output: 'static',
  adapter: vercel(),
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'vi', 'zh'],
    routing: {
      prefixDefaultLocale: false
    }
  },
  vite: {
    plugins: [tailwindcss()]
  }
});
