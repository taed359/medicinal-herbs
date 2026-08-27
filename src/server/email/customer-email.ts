/**
 * Smallest possible transactional-email abstraction for customer auth
 * (verification + password reset). No provider has been selected yet (per
 * the approved architecture) — this defines a generic HTTP contract
 * (`to`/`from`/`subject`/`html`/`text`, Bearer-token auth) that most
 * transactional email providers can be adapted to, isolated to the single
 * `deliverEmail` function below so swapping providers later never touches
 * the call sites in src/server/auth/customer-auth.ts.
 *
 * Required environment variables (none of these exist in .env.example yet
 * — must be added before this can actually deliver mail):
 *   EMAIL_PROVIDER_API_URL   — the provider's send-email HTTP endpoint
 *   EMAIL_PROVIDER_API_KEY   — Bearer token for that endpoint
 *   EMAIL_FROM_ADDRESS       — the verified "from" address for this deployment
 *
 * If any are unset, sending fails LOUDLY (throws EmailNotConfiguredError)
 * rather than faking success — see this module's callers, which rely on
 * Better Auth's own `runInBackgroundOrAwait` to swallow this error so an
 * unconfigured email provider never rolls back a successful registration
 * or leaks a "does this email exist" signal to the client (verified in
 * node_modules/better-auth/dist/context/create-context.mjs:
 * runInBackgroundOrAwait awaits the promise and only logs on failure, it
 * never rethrows to the endpoint).
 */

export class EmailNotConfiguredError extends Error {}

interface DeliverEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

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

  const res = await fetch(apiUrl, {
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
  });

  if (!res.ok) {
    // Never log response body -- provider errors can echo back request
    // content (including the recipient address); status is enough to act on.
    throw new Error(`Email provider responded with status ${res.status}.`);
  }
}

export async function sendCustomerVerificationEmail(to: string, url: string): Promise<void> {
  await deliverEmail({
    to,
    subject: 'Verify your email',
    text: `Verify your email by visiting: ${url}`,
    html: `<p>Verify your email by clicking the link below.</p><p><a href="${url}">${url}</a></p>`,
  });
}

export async function sendCustomerPasswordResetEmail(to: string, url: string): Promise<void> {
  await deliverEmail({
    to,
    subject: 'Reset your password',
    text: `Reset your password by visiting: ${url}`,
    html: `<p>Reset your password by clicking the link below. If you didn't request this, you can ignore this email.</p><p><a href="${url}">${url}</a></p>`,
  });
}
