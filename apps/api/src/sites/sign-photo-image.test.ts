import sharp from 'sharp';
import { expect, it } from 'vitest';
import { createSignPhotoThumbnail } from './sign-photo-image.js';
it('sign-photos REQ-010: verifies decoded format and strips metadata from thumbnail', async () => {
  const original = await sharp({
    create: { width: 80, height: 40, channels: 3, background: '#ffb400' },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const thumb = await createSignPhotoThumbnail(original, 'image/jpeg');
  const metadata = await sharp(thumb).metadata();
  expect(metadata.format).toBe('png');
  expect(metadata.exif).toBeUndefined();
  expect(metadata.width).toBe(40);
  expect(metadata.height).toBe(80);
  await expect(
    createSignPhotoThumbnail(original, 'image/png'),
  ).rejects.toThrow();
  await expect(
    createSignPhotoThumbnail(Buffer.from('%PDF-1.7'), 'image/jpeg'),
  ).rejects.toThrow();
  await expect(
    createSignPhotoThumbnail(Buffer.from([255, 216, 255, 217]), 'image/jpeg'),
  ).rejects.toThrow();
});
