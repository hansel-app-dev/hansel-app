import { describe, expect, it } from 'vitest';
import { signDocumentUploadSchema } from './sign-documents.js';

describe('sign-documents REQ-004,008', () => {
  const input = {
    idempotencyKey: 'e4a519b9-a654-4a89-bb32-811f44529b98',
    filename: 'drawing.pdf',
    mediaType: 'application/pdf',
    byteSize: 5242880,
    checksumSha256: 'A'.repeat(43) + '=',
  };
  it('accepts the exact size boundary', () => {
    expect(signDocumentUploadSchema.safeParse(input).success).toBe(true);
  });
  it.each([0, 5242881])('rejects invalid size %s', (byteSize) => {
    expect(
      signDocumentUploadSchema.safeParse({ ...input, byteSize }).success,
    ).toBe(false);
  });
  it('rejects unsupported media and unsafe names', () => {
    expect(
      signDocumentUploadSchema.safeParse({ ...input, mediaType: 'text/html' })
        .success,
    ).toBe(false);
    expect(
      signDocumentUploadSchema.safeParse({ ...input, filename: '../file.pdf' })
        .success,
    ).toBe(false);
  });
});
