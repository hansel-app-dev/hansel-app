import { expect, it } from 'vitest';
import { signPhotoUploadSchema } from './sign-photos.js';
it('sign-photos REQ-007: accepts PNG/JPEG at boundary; rejects PDF, empty and oversized files', () => {
  const input = {
    idempotencyKey: '33e82388-a951-4d52-b6d6-0b5cde568763',
    filename: 'sign.jpg',
    mediaType: 'image/jpeg',
    byteSize: 5242880,
    checksumSha256: 'A'.repeat(43) + '=',
  };
  expect(signPhotoUploadSchema.safeParse(input).success).toBe(true);
  expect(
    signPhotoUploadSchema.safeParse({ ...input, mediaType: 'image/png' })
      .success,
  ).toBe(true);
  for (const changes of [
    { mediaType: 'application/pdf' },
    { byteSize: 0 },
    { byteSize: 5242881 },
  ])
    expect(
      signPhotoUploadSchema.safeParse({ ...input, ...changes }).success,
    ).toBe(false);
});
