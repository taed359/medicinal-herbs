import type { Locale } from '../i18n/utils';

/**
 * Display-label helpers for controlled-vocabulary-ish product metadata
 * (extraction method, country of origin). Neither `extraction_method` nor
 * `country_of_origin_code` carries a database CHECK constraint (see
 * src/db/schema.ts) — they're documented conventions, not enforced enums —
 * so every lookup here falls back to showing the raw stored value rather
 * than silently hiding or mistranslating a code this map doesn't know
 * about yet. Nothing here invents a value; it only formats one that
 * already exists in the database.
 */

const EXTRACTION_METHOD_LABELS: Record<string, Record<Locale, string>> = {
  'cold-pressed': { vi: 'Ép lạnh', zh: '冷压' },
  'expeller-pressed': { vi: 'Ép cơ học (expeller)', zh: '螺旋压榨' },
  refined: { vi: 'Tinh luyện', zh: '精炼' },
  'virgin-unrefined': { vi: 'Nguyên chất, chưa tinh luyện', zh: '未精炼初榨' },
};

// Common countries of origin for natural-oil sourcing. Deliberately not
// exhaustive — unmapped codes fall back to the raw ISO code rather than
// being guessed at.
const COUNTRY_LABELS: Record<string, Record<Locale, string>> = {
  VN: { vi: 'Việt Nam', zh: '越南' },
  PH: { vi: 'Philippines', zh: '菲律宾' },
  ID: { vi: 'Indonesia', zh: '印度尼西亚' },
  LK: { vi: 'Sri Lanka', zh: '斯里兰卡' },
  IN: { vi: 'Ấn Độ', zh: '印度' },
  TH: { vi: 'Thái Lan', zh: '泰国' },
  MY: { vi: 'Malaysia', zh: '马来西亚' },
};

export function formatExtractionMethod(code: string, locale: Locale): string {
  return EXTRACTION_METHOD_LABELS[code]?.[locale] ?? code;
}

export function formatCountryOfOrigin(code: string, locale: Locale): string {
  return COUNTRY_LABELS[code.toUpperCase()]?.[locale] ?? code;
}

/**
 * `cert_type` has no CHECK constraint (free text) and no real certification
 * rows exist yet for any product, so there's no confirmed vocabulary to
 * translate against. This only reformats the stored code for display
 * (kebab/snake-case -> Title Case) — it never fabricates a translation.
 */
export function formatCertType(code: string): string {
  return code
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
