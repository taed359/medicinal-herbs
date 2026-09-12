// Shared between src/components/HealthReadDetailPage.astro and both
// src/pages/{vi,zh}/health-reads/[slug].astro route files.
//
// This lives in its own module (rather than as a local `const` inside
// [slug].astro) because of a real Astro constraint: getStaticPaths() runs
// in an isolated scope, before the rest of the page module's frontmatter
// executes, and can only see file imports (and true globals) -- not local
// consts declared elsewhere in the same frontmatter, even though they
// look like they're in the same closure. A local `const SLUG_TO_KEY = ...`
// above `export async function getStaticPaths()` compiles fine and passes
// `tsc`, but throws "SLUG_TO_KEY is not defined" at dev/build time the
// moment getStaticPaths actually runs. Importing it instead sidesteps the
// restriction entirely, since imports are exactly what's allowed.

export type HRKey = 'childrensHealth' | 'chronicIllness' | 'womensHealth' | 'tcmBasics';

// Slugs are the same literal strings across both locales (see
// t.healthReads.items.*.slug in vi.ts/zh.ts).
export const SLUG_TO_KEY: Record<string, HRKey> = {
  'childrens-health': 'childrensHealth',
  'chronic-illness': 'chronicIllness',
  'women-health': 'womensHealth',
  'tcm-basics': 'tcmBasics',
};
