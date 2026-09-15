import {
  startCoverImageResponseSchema,
  finalizeCoverImageResponseSchema,
} from '@hansel/contracts';
import { DashboardAuthenticationRequiredError } from '../api.js';

const attempts = new WeakMap<File, Map<string, string>>();

export async function uploadSiteCoverImage(
  siteId: string,
  file: File,
  baseUrl = '',
  fetcher = fetch,
): Promise<void> {
  let keys = attempts.get(file);
  if (!keys) {
    keys = new Map();
    attempts.set(file, keys);
  }
  let key = keys.get(siteId);
  if (!key) {
    key = crypto.randomUUID();
    keys.set(siteId, key);
  }
  const checksum = Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', await file.arrayBuffer()),
    ),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
  const path = `${baseUrl}/api/sites/${siteId}/cover-image-uploads`;
  const start = await fetcher(path, {
    method: 'POST',
    credentials: 'include',
    signal: AbortSignal.timeout(30_000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotencyKey: key,
      filename: file.name,
      mediaType: file.type,
      byteSize: file.size,
      checksum,
    }),
  });
  if (start.status === 401) throw new DashboardAuthenticationRequiredError();
  if (!start.ok) throw new Error('cover_image_start_failed');
  const { uploadId } = startCoverImageResponseSchema.parse(await start.json());
  const result = await fetcher(`${path}/${uploadId}/finalize`, {
    method: 'POST',
    credentials: 'include',
    signal: AbortSignal.timeout(30_000),
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (result.status === 401) throw new DashboardAuthenticationRequiredError();
  if (!result.ok) throw new Error('cover_image_finalize_failed');
  const { destination } = finalizeCoverImageResponseSchema.parse(
    await result.json(),
  );
  if (destination !== `/sites/${siteId}/activity`)
    throw new Error('invalid_destination');
}
