import { getTranslations, type Locale, type TranslationSchema } from './utils';

/**
 * Locale handling for the customer auth pages (src/pages/customer/*.astro)
 * is deliberately separate from the rest of the site's /vi//zh/ path-based
 * routing (see src/i18n/utils.ts). Two things outside this app's control
 * hardcode the unprefixed `/customer/*` path:
 *   - src/middleware.ts's session gate matches `pathname.startsWith('/customer/')`
 *     literally -- a /vi/customer/login route would silently skip session
 *     resolution and the no-store cache header.
 *   - src/server/auth/customer-auth.ts builds its password-reset and
 *     verification email links as `${BETTER_AUTH_URL}/customer/reset-password`
 *     / `/customer/verify-email` -- a locale-prefixed page would never be
 *     the one a real email link lands on.
 * So these 5 pages stay on their single unprefixed route and switch
 * language via a `?lang=` query param instead, using the exact same
 * TranslationSchema/getTranslations dictionaries as the rest of the site.
 *
 * English is deliberately NOT offered here -- the customer auth UI is
 * VI/ZH only (see the task that removed it), unlike the rest of the site
 * where English is the unprefixed default locale.
 */
export type AuthLocale = Locale;

export const authLocales: AuthLocale[] = ['vi', 'zh'];

export const authLocaleMeta: Record<AuthLocale, { label: string; flag: string }> = {
  vi: { label: 'VI', flag: '🇻🇳' },
  zh: { label: 'ZH', flag: '🇨🇳' },
};

export function isAuthLocale(value: string | null | undefined): value is AuthLocale {
  return value === 'vi' || value === 'zh';
}

/** Reads `?lang=` and falls back to 'vi' for anything missing or
 *  unrecognized -- NOT 'en'; there is no English auth UI. */
export function resolveAuthLocale(searchParams: URLSearchParams): AuthLocale {
  const value = searchParams.get('lang');
  return isAuthLocale(value) ? value : 'vi';
}

export function getAuthTranslations(lang: AuthLocale): TranslationSchema['auth'] {
  return getTranslations(lang).auth;
}

/** Href for switching to `target` locale from the given URL: preserves
 *  every existing query parameter (redirect, token, ...) and only sets
 *  `lang`, never touching the path. */
export function buildAuthLangHref(url: URL, target: AuthLocale): string {
  const params = new URLSearchParams(url.search);
  params.set('lang', target);
  return `${url.pathname}?${params.toString()}`;
}

/** Cross-links between the 5 auth pages (e.g. login -> register, forgot-
 *  password -> login) always carry the current `lang` forward, plus
 *  whatever caller-supplied params matter for that link (redirect, token).
 *  Centralized here so every page builds these the same way. */
export function authPageHref(
  page: 'login' | 'register' | 'forgot-password' | 'reset-password' | 'verify-email',
  lang: AuthLocale,
  extraParams: Record<string, string> = {}
): string {
  const params = new URLSearchParams(extraParams);
  params.set('lang', lang);
  return `/customer/${page}?${params.toString()}`;
}

/** vi/zh use the storefront's `/vi(or zh)/policies/privacy-policy` slug --
 *  a small explicit map since it's not a `localePath()`-expressible path
 *  transform. */
const PRIVACY_POLICY_PATHS: Record<AuthLocale, string> = {
  vi: '/vi/policies/privacy-policy',
  zh: '/zh/policies/privacy-policy',
};

export function privacyPolicyHref(lang: AuthLocale): string {
  return PRIVACY_POLICY_PATHS[lang];
}
