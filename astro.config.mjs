// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

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
// No production domain is registered yet -- this is the project's Vercel
// preview/demo URL. Update this the day a real domain goes live (and
// nothing else needs to change: sitemap URLs, canonical links, and
// hreflang alternates in Layout.astro all derive from this one value).
const SITE_URL = 'https://medicinal-herbs.vercel.app';

export default defineConfig({
  site: SITE_URL,
  output: 'static',
  adapter: vercel(),
  integrations: [
    sitemap({
      // Deliberately NOT using this integration's own `i18n` grouping
      // option: it infers hreflang alternates by assuming every locale's
      // URL differs ONLY by its locale-prefix segment, which doesn't
      // hold here (e.g. the unprefixed /privacy-policy vs.
      // /vi/policies/privacy-policy and /zh/policies/privacy-policy add
      // an extra `policies/` segment that isn't mirrored at the root) --
      // guessing wrong there would silently mis-tag pages. The correct,
      // explicit hreflang <link> tags live in src/layouts/Layout.astro
      // instead, built from the same `swapLocaleInPath` helper the rest
      // of the site already trusts for vi<->zh URL swaps.
      filter: (page) => {
        const path = new URL(page).pathname;
        // Admin/customer/API routes are `prerender = false` (on-demand,
        // not static HTML) so the sitemap integration likely never sees
        // them anyway -- excluded explicitly here too, as cheap
        // insurance rather than relying on that.
        if (path.startsWith('/admin/') || path.startsWith('/api/') || path.startsWith('/customer/')) return false;
        // Internal search results pages: no fixed indexable content
        // (results depend on a query string a sitemap can't express) --
        // standard practice is to keep these out of the sitemap (see
        // also the `noindex` meta tag SearchPage.astro sets via
        // Layout's `noindex` prop).
        if (path === '/vi/search/' || path === '/zh/search/' || path === '/vi/search' || path === '/zh/search') return false;
        // Bare `/` is a pure redirect to /vi/ (see src/pages/index.astro)
        // with no real content of its own -- /vi/ is the actual indexable
        // homepage and already carries the x-default hreflang.
        if (path === '/') return false;
        return true;
      },
    }),
  ],
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
