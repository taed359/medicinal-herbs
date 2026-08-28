/**
 * Transactional-email boundary for customer auth (verification + password
 * reset). Provider: Resend, reached with plain fetch() — no SDK, no new
 * dependency (see the provider audit this implements). Isolated to the
 * single `deliverEmail` function below so swapping providers later never
 * touches the call sites in src/server/auth/customer-auth.ts: Resend's own
 * request shape (`{from,to,subject,html,text}` JSON body, Bearer auth) is
 * already exactly the generic contract this module exposed before a
 * provider was chosen, so adopting Resend required no shape change here.
 *
 * Required environment variables (see .env.example for the real values):
 *   EMAIL_PROVIDER_API_URL   — https://api.resend.com/emails
 *   EMAIL_PROVIDER_API_KEY   — a Resend API key (Bearer token)
 *   EMAIL_FROM_ADDRESS       — the verified "from" address for this deployment
 *
 * If any are unset, sending fails LOUDLY (throws EmailNotConfiguredError)
 * rather than faking success — see this module's callers, which rely on
 * Better Auth's own `runInBackgroundOrAwait` to swallow this error so an
 * unconfigured email provider never rolls back a successful registration
 * or leaks a "does this email exist" signal to the client (verified in
 * node_modules/better-auth/dist/context/create-context.mjs:
 * runInBackgroundOrAwait awaits the promise and only logs on failure, it
 * never rethrows to the endpoint). That same await means a slow provider
 * call adds latency to the caller's response, which is exactly why
 * `deliverEmail` below bounds it with a timeout instead of leaving the
 * request hanging on a stalled connection.
 *
 * Logging discipline: every error thrown from this module is a fixed,
 * generic string plus (at most) an HTTP status code — never the request
 * body (which contains the recipient address and the verification/reset
 * URL, i.e. the token), never the response body (providers can echo
 * request content back in error payloads), and never the API key. Nothing
 * in this file calls console.* itself; Better Auth's own logger is what
 * eventually logs a thrown error, so keeping these messages generic is
 * what keeps that downstream log line safe.
 *
 * Localization: both send functions take a `locale: Locale` ('vi' | 'zh'
 * only, see src/i18n/utils.ts -- no English auth UI). This module trusts
 * that argument completely; validating an untrusted client-supplied locale
 * down to exactly 'vi' | 'zh' is customer-auth.ts's job, done once before
 * calling in here. Email copy lives in the same TranslationSchema/vi.ts/
 * zh.ts dictionaries as the rest of the site (under `auth.emails`) rather
 * than a second i18n system.
 */

import { getTranslations, type Locale } from '../../i18n/utils';

export class EmailNotConfiguredError extends Error {}

interface DeliverEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

// Bounds worst-case added latency on the caller (see the file-level note
// above: Better Auth awaits this inline). Generous enough for a normal
// transactional-email API call, short enough that a stalled connection
// fails fast instead of stalling the user's sign-up/reset-request response.
const SEND_TIMEOUT_MS = 8000;

async function deliverEmail(input: DeliverEmailInput): Promise<void> {
  const apiUrl = process.env.EMAIL_PROVIDER_API_URL;
  const apiKey = process.env.EMAIL_PROVIDER_API_KEY;
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;

  if (!apiUrl || !apiKey || !fromAddress) {
    const missing = [
      !apiUrl && 'EMAIL_PROVIDER_API_URL',
      !apiKey && 'EMAIL_PROVIDER_API_KEY',
      !fromAddress && 'EMAIL_FROM_ADDRESS',
    ].filter(Boolean).join(', ');
    throw new EmailNotConfiguredError(`Email sending is not configured. Set: ${missing}.`);
  }

  let res: Response;
  try {
    res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
  } catch (err) {
    // Network/DNS failure or timeout -- `err` here is a generic fetch
    // TypeError or a DOMException from AbortSignal.timeout, never
    // provider/response content, so it's safe to let it propagate as-is
    // without re-wrapping (no secrets, no PII in either error shape).
    throw err;
  }

  if (!res.ok) {
    // Never log response body -- provider errors can echo back request
    // content (including the recipient address); status is enough to act on.
    throw new Error(`Email provider responded with status ${res.status}.`);
  }
}

// --- Minimal, dependency-free HTML email skeleton ---------------------
// Table-based layout + inline styles only (no <style> block, since many
// clients strip <head> styles) -- the one layout approach that renders
// consistently across Outlook/Gmail/Apple Mail without a template engine.
// Colors copied BY VALUE from public/customer.css's --auth-* tokens (same
// approach that file itself already documents for its own token values)
// so these emails read as visually continuous with the page the link
// lands on, without importing anything from the storefront's Tailwind build.
const BRAND = {
  bg: '#F6F1E8',
  surface: '#FCFAF5',
  heading: '#292D27',
  body: '#5F625B',
  border: '#DDD5C7',
  brand: '#3F5B45',
};

interface EmailCopy {
  heading: string;
  paragraphs: string[];
  ctaLabel: string;
  ctaUrl: string;
  expiryNote: string;
  ignoreNote: string;
  fallbackLinkNote: string;
}

function renderEmailHtml(copy: EmailCopy, locale: Locale, siteName: string): string {
  const paragraphsHtml = copy.paragraphs
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BRAND.body};">${p}</p>`)
    .join('');

  return `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${copy.heading}</title>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${copy.heading}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:12px;">
            <tr>
              <td style="padding:32px 32px 8px;text-align:center;">
                <span style="font-size:20px;font-weight:800;color:${BRAND.heading};">${siteName}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 0;">
                <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:${BRAND.heading};">${copy.heading}</h1>
                ${paragraphsHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 24px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:24px;background:${BRAND.brand};">
                      <a href="${copy.ctaUrl}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:700;color:${BRAND.surface};text-decoration:none;border-radius:24px;">${copy.ctaLabel}</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px;">
                <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:${BRAND.body};">${copy.expiryNote}</p>
                <p style="margin:0;font-size:13px;line-height:1.5;color:${BRAND.body};">${copy.ignoreNote}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;border-top:1px solid ${BRAND.border};">
                <p style="margin:0;font-size:12px;line-height:1.5;color:${BRAND.body};word-break:break-all;">${copy.fallbackLinkNote}<br /><a href="${copy.ctaUrl}" style="color:${BRAND.brand};">${copy.ctaUrl}</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderEmailText(copy: EmailCopy): string {
  return [
    copy.heading,
    '',
    ...copy.paragraphs,
    '',
    `${copy.ctaLabel}: ${copy.ctaUrl}`,
    '',
    copy.expiryNote,
    copy.ignoreNote,
  ].join('\n');
}

/** VI/ZH only -- no English fallback anywhere in this module (see the
 *  customer auth i18n work: the auth UI itself is VI/ZH-only). Callers
 *  (src/server/auth/customer-auth.ts) are responsible for validating an
 *  untrusted locale value down to exactly 'vi' | 'zh' BEFORE it reaches
 *  here -- this function trusts its `locale` argument completely, the same
 *  way it already trusts `to`/`url`. */
function resolveEmailCopy(
  locale: Locale,
  section: 'verification' | 'passwordReset',
  url: string
): { subject: string; copy: EmailCopy; siteName: string } {
  const t = getTranslations(locale);
  const siteName = t.common.siteName;
  const emails = t.auth.emails;
  const strings = emails[section];
  const withSiteName = (s: string) => s.replace(/\{siteName\}/g, siteName);

  return {
    subject: withSiteName(strings.subject),
    siteName,
    copy: {
      heading: strings.heading,
      paragraphs: [withSiteName(strings.paragraph)],
      ctaLabel: strings.ctaLabel,
      ctaUrl: url,
      expiryNote: emails.common.expiryNote,
      ignoreNote: strings.ignoreNote,
      fallbackLinkNote: emails.common.fallbackLinkNote,
    },
  };
}

export async function sendCustomerVerificationEmail(to: string, url: string, locale: Locale): Promise<void> {
  const { subject, copy, siteName } = resolveEmailCopy(locale, 'verification', url);

  await deliverEmail({
    to,
    subject,
    html: renderEmailHtml(copy, locale, siteName),
    text: renderEmailText(copy),
  });
}

export async function sendCustomerPasswordResetEmail(to: string, url: string, locale: Locale): Promise<void> {
  const { subject, copy, siteName } = resolveEmailCopy(locale, 'passwordReset', url);

  await deliverEmail({
    to,
    subject,
    html: renderEmailHtml(copy, locale, siteName),
    text: renderEmailText(copy),
  });
}
