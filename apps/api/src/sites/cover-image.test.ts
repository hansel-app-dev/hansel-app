/** @spec site-cover-image-add REQ-003, REQ-011 */
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { sanitizeCoverImage } from './cover-image.js';

describe('cover image validation', () => {
  it('decodes PNG and JPEG and strips metadata before storage', async () => {
    for (const format of ['png', 'jpeg'] as const) {
      const bytes = await sharp({
        create: { width: 4, height: 4, channels: 3, background: '#123456' },
      })
        .toFormat(format)
        .withMetadata()
        .toBuffer();
      const result = await sanitizeCoverImage(bytes, `image/${format}`);
      const metadata = await sharp(result).metadata();
      expect(metadata.format).toBe(format);
      expect(metadata.exif).toBeUndefined();
      expect(metadata.icc).toBeUndefined();
    }
  });
  it('rejects malformed, oversized and type-mismatched images', async () => {
    await expect(
      sanitizeCoverImage(Buffer.from('not an image'), 'image/png'),
    ).rejects.toThrow();
    await expect(
      sanitizeCoverImage(Buffer.alloc(3_000_001), 'image/png'),
    ).rejects.toThrow();
    const png = await sharp({
      create: { width: 1, height: 1, channels: 3, background: '#000' },
    })
      .png()
      .toBuffer();
    await expect(sanitizeCoverImage(png, 'image/jpeg')).rejects.toThrow();
    await expect(
      sanitizeCoverImage(
        Buffer.concat([png, Buffer.from('<script>')]),
        'image/png',
      ),
    ).rejects.toThrow();
  });
});
