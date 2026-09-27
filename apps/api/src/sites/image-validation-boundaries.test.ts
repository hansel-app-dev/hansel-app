import { expect, it, vi } from 'vitest';
import { sanitizeCoverImage } from './cover-image.js';
import { createSignPhotoThumbnail } from './sign-photo-image.js';
const codec = vi.hoisted(() => ({ metadata: vi.fn(), toBuffer: vi.fn() }));
vi.mock('sharp', () => ({
  default: () => {
    const image = {
      metadata: codec.metadata,
      toBuffer: codec.toBuffer,
      rotate: () => image,
      toFormat: () => image,
      timeout: () => image,
      resize: () => image,
      png: () => image,
    };
    return image;
  },
}));
const png = Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
it('image validation rejects mismatched formats, multiple pages and re-encoded oversize output', async () => {
  await expect(createSignPhotoThumbnail(png, 'text/plain')).rejects.toThrow(
    'invalid_image',
  );
  for (const metadata of [{ format: 'jpeg' }, { format: 'png', pages: 2 }]) {
    codec.metadata.mockResolvedValue(metadata);
    await expect(sanitizeCoverImage(png, 'image/png')).rejects.toThrow(
      'invalid_image',
    );
    await expect(createSignPhotoThumbnail(png, 'image/png')).rejects.toThrow(
      'invalid_image',
    );
  }
  codec.metadata.mockResolvedValue({ format: 'png' });
  codec.toBuffer.mockResolvedValue(Buffer.alloc(3_000_001));
  await expect(sanitizeCoverImage(png, 'image/png')).rejects.toThrow(
    'invalid_image',
  );
  codec.toBuffer.mockResolvedValue(png);
  await expect(sanitizeCoverImage(png, 'image/png')).resolves.toEqual(png);
  await expect(createSignPhotoThumbnail(png, 'image/png')).resolves.toEqual(
    png,
  );
});
