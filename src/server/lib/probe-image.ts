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

const MAX_BYTES = 15 * 1024 * 1024; // 15MB -- generous for a product photo, small enough to bound memory/time
const FETCH_TIMEOUT_MS = 10_000;

export interface ProbedImage {
  width: number;
  height: number;
}

export class ImageProbeError extends Error {}

export async function probeImageDimensions(url: string): Promise<ProbedImage> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ImageProbeError('Not a valid URL.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ImageProbeError('Image URL must be http(s).');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(parsed, { signal: controller.signal });
  } catch {
    throw new ImageProbeError('Could not reach that image URL.');
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok || !res.body) {
    throw new ImageProbeError(`Image URL responded with ${res.status}.`);
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
