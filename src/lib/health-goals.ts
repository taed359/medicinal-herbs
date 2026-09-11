import type { ImageMetadata } from 'astro';
import beauty from '../assets/images/health-goals/beauty.svg';
import energy from '../assets/images/health-goals/energy.svg';
import generalWellness from '../assets/images/health-goals/general-wellness.svg';
import immunity from '../assets/images/health-goals/immunity.svg';
import mensWellness from '../assets/images/health-goals/mens-wellness.svg';
import jointHeart from '../assets/images/health-goals/joint-heart.svg';
import mindFocus from '../assets/images/health-goals/mind-focus.svg';
import sleepStress from '../assets/images/health-goals/sleep-stress.svg';
import womensHealth from '../assets/images/health-goals/womens-health.svg';

/** Matches `t.healthGoals.items`/`t.healthGoals.descriptions` in
 * src/i18n/utils.ts -- kept as its own type here (rather than importing
 * `keyof TranslationSchema['healthGoals']['items']`) so this module has no
 * dependency on the i18n system, only the other direction. */
export type HealthGoalKey =
  | 'beauty'
  | 'energy'
  | 'generalWellness'
  | 'immunity'
  | 'mensWellness'
  | 'jointHeart'
  | 'mindFocus'
  | 'sleepStress'
  | 'womensHealth';

export interface HealthGoalDefinition {
  slug: string;
  key: HealthGoalKey;
  image: ImageMetadata;
}

/**
 * Single source of truth for the 9 health goals -- URL slug, i18n key, and
 * hero/thumbnail SVG. Shared by HealthGoals.astro (the homepage
 * carousel/grid) and src/pages/{vi,zh}/health-goals/[slug].astro (the
 * actual landing pages those tiles link to) plus the health-goals index
 * listing and Footer.astro's "Shop by Goal" column, so none of them can
 * drift out of sync with each other -- a slug that only existed in one
 * place used to be exactly the bug that left links pointing at pages that
 * don't exist (see the git history on HealthGoals.astro before this file
 * existed).
 */
export const HEALTH_GOALS: readonly HealthGoalDefinition[] = [
  { slug: 'beauty', key: 'beauty', image: beauty },
  { slug: 'energy', key: 'energy', image: energy },
  { slug: 'general-wellness', key: 'generalWellness', image: generalWellness },
  { slug: 'immunity', key: 'immunity', image: immunity },
  { slug: 'mens-wellness', key: 'mensWellness', image: mensWellness },
  { slug: 'joint-heart', key: 'jointHeart', image: jointHeart },
  { slug: 'mind-focus', key: 'mindFocus', image: mindFocus },
  { slug: 'sleep-stress', key: 'sleepStress', image: sleepStress },
  { slug: 'womens-health', key: 'womensHealth', image: womensHealth },
] as const;

export function getHealthGoalBySlug(slug: string): HealthGoalDefinition | undefined {
  return HEALTH_GOALS.find((goal) => goal.slug === slug);
}
