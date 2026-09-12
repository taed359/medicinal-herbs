/**
 * Small server-side formatting helpers shared by the customer account
 * pages that display order data (src/pages/customer/account.astro and
 * src/pages/customer/orders/[orderNumber].astro) -- extracted so both
 * pages format money/dates/statuses identically instead of drifting.
 * Deliberately separate from src/lib/cart-client.ts's own `formatMoney`,
 * which reads `document`/`navigator` and only runs in the browser (see
 * its own doc comment) -- these run at request time in Astro frontmatter,
 * so they take the resolved locale as a plain argument instead.
 */
import type { Locale, TranslationSchema } from '../i18n/utils';

export function formatOrderMoney(minorUnits: number, currency: string, lang: Locale): string {
  return new Intl.NumberFormat(lang === 'zh' ? 'zh-CN' : 'vi-VN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(minorUnits);
}

export function formatOrderDate(iso: string, lang: Locale): string {
  return new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

/** All 6 `orders.status` values, translated -- see the doc comment on
 *  src/i18n/utils.ts's `orderConfirmation.statusConfirmedLabel` etc. for
 *  why this map needed to grow from just `pending` in the first place
 *  (OrderConfirmationPage.astro used to fall back to the raw English
 *  status word for every other status). Callers should fall back to the
 *  raw `status` string themselves (`labels[status] || status`) so an
 *  unexpected/future status value never renders blank. */
export function getOrderStatusLabels(t: TranslationSchema): Record<string, string> {
  return {
    pending: t.orderConfirmation.statusPendingLabel,
    confirmed: t.orderConfirmation.statusConfirmedLabel,
    processing: t.orderConfirmation.statusProcessingLabel,
    shipped: t.orderConfirmation.statusShippedLabel,
    completed: t.orderConfirmation.statusCompletedLabel,
    cancelled: t.orderConfirmation.statusCancelledLabel,
  };
}
