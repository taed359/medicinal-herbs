/**
 * Measures the real width/height of an image URL an admin operator pastes
 * into the product form. product_images.width/height are NOT NULL (see
 * src/db/schema.ts) -- this codebase's own convention (repeated across
 * every seed script's doc comments) is to never invent a value for a
 * required column, so the admin form can't just ask the operator to type
 * dimensions either (they'd be guessing, or lying). Instead: fetch the
 * bytes server-side and read the real dimensions out of the file with
 * `sharp`, which is already a project dependency (src/assets image
 * processing) -- no new package needed.
 */
import sharp, { type Metadata } from 'sharp';
import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const MAX_BYTES = 15 * 1024 * 1024; // 15MB -- generous for a product photo, small enough to bound memory/time
const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;

export interface ProbedImage {
  width: number;
  height: number;
}

export class ImageProbeError extends Error {}

/**
 * SSRF guard: this function's whole job is "make the server fetch a URL an
 * admin operator typed into a form," which is the textbook SSRF shape --
 * without this check, pasting `http://169.254.169.254/latest/meta-data/`
 * (cloud instance-metadata endpoint) or `http://localhost:<internal-port>`
 * makes THIS SERVER issue that request, and the distinct error messages
 * below it (`Could not reach` vs. `responded with 404` vs. `did not
 * return a readable image`) are already enough to blind-probe which
 * internal hosts/ports exist, even though the response body itself is
 * never echoed back. Requiring admin auth (this is only reachable from
 * /api/admin/products, already session+CSRF gated) narrows who can try
 * this, but doesn't make the request itself safe to issue.
 *
 * Resolves the hostname and rejects loopback/private/link-local/reserved
 * ranges -- checked on the RESOLVED IP, not the hostname string, so a
 * hostname that merely LOOKS external but resolves internally is still
 * caught (DNS rebinding to a private IP, `0x7f.1` / decimal / other
 * loopback-IP-as-a-different-string tricks all resolve down to a real
 * IP by the time `dns.lookup` returns, which is what's actually checked).
 */
function isBlockedIp(address: string, family: number): boolean {
  if (family === 4) {
    const parts = address.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true; // malformed -- fail closed
    const [a, b] = parts;
    if (a === 127) return true; // loopback
    if (a === 10) return true; // RFC1918
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
    if (a === 192 && b === 168) return true; // RFC1918
    if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata (169.254.169.254)
    if (a === 0) return true; // "this network"
    if (a >= 224) return true; // multicast/reserved (224-255)
    return false;
  }
  // IPv6
  const lower = address.toLowerCase();
  if (lower === '::1') return true; // loopback
  if (lower === '::') return true; // unspecified
  if (lower.startsWith('fe80:') || lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true; // link-local fe80::/10
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local fc00::/7
  if (lower.startsWith('::ffff:')) return isBlockedIp(lower.slice(7), 4); // IPv4-mapped IPv6 -- unwrap and re-check as v4
  return false;
}

async function assertPublicHost(hostname: string): Promise<void> {
  let resolved: { address: string; family: number };
  try {
    resolved = await dnsLookup(hostname);
  } catch {
    throw new ImageProbeError('Could not resolve that image URL\'s host.');
  }
  if (isBlockedIp(resolved.address, resolved.family)) {
    throw new ImageProbeError('That image URL points to a disallowed address.');
  }
}

export async function probeImageDimensions(url: string): Promise<ProbedImage> {
  let current: URL;
  try {
    current = new URL(url);
  } catch {
    throw new ImageProbeError('Not a valid URL.');
  }

  // Manually follows redirects (capped) instead of letting fetch() follow
  // them automatically -- an attacker-controlled URL that passes the
  // public-host check could otherwise 30x to an internal address and
  // reach it anyway, since fetch's automatic redirect handling never
  // re-runs this validation on the new location.
  let res: Response | undefined;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (current.protocol !== 'http:' && current.protocol !== 'https:') {
      throw new ImageProbeError('Image URL must be http(s).');
    }
    if (!isIP(current.hostname)) {
      await assertPublicHost(current.hostname);
    } else if (isBlockedIp(current.hostname, isIP(current.hostname))) {
      throw new ImageProbeError('That image URL points to a disallowed address.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      res = await fetch(current, { signal: controller.signal, redirect: 'manual' });
    } catch {
      throw new ImageProbeError('Could not reach that image URL.');
    } finally {
      clearTimeout(timeout);
    }

    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      if (hop === MAX_REDIRECTS) throw new ImageProbeError('Too many redirects.');
      current = new URL(res.headers.get('location')!, current);
      continue;
    }
    break;
  }

  if (!res || !res.ok || !res.body) {
    throw new ImageProbeError(`Image URL responded with ${res?.status ?? 'no response'}.`);
  }

  const contentLength = res.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_BYTES) {
    throw new ImageProbeError('Image is too large (max 15MB).');
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength > MAX_BYTES) {
    throw new ImageProbeError('Image is too large (max 15MB).');
  }

  let metadata: Metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    throw new ImageProbeError('That URL did not return a readable image.');
  }

  if (!metadata.width || !metadata.height) {
    throw new ImageProbeError('Could not determine image dimensions.');
  }

  return { width: metadata.width, height: metadata.height };
}
