import { describe, expect, it, vi } from 'vitest';
import { createS3AllocationPlanObjectStore } from './s3-allocation-plan-object-store.js';

describe('S3 Allocation Plan objects [site-allocation-plans-add REQ-009..REQ-014]', () => {
  it('creates its production client and signer defaults lazily', () => {
    expect(
      createS3AllocationPlanObjectStore({ bucketName: 'private' }),
    ).toBeDefined();
  });
  it('signs exact uploads, inspects bounded bytes, and removes rejects [AC-001, AC-002]', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        ContentLength: 5,
        ContentType: 'application/pdf',
        ChecksumSHA256: 'sum',
      })
      .mockResolvedValueOnce({
        Body: {
          transformToByteArray: () => Promise.resolve(new Uint8Array([1, 2])),
        },
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    const sign = vi.fn().mockResolvedValue('https://uploads.example/one');
    const store = createS3AllocationPlanObjectStore({
      bucketName: 'private',
      client: { send } as never,
      sign,
    });
    await expect(
      store.signPut({
        objectKey: 'quarantine/one',
        mediaType: 'application/pdf',
        byteSize: 5,
        checksumSha256: 'sum',
        expiresInSeconds: 900,
      }),
    ).resolves.toBe('https://uploads.example/one');
    await expect(store.inspect('quarantine/one')).resolves.toEqual({
      byteSize: 5,
      mediaType: 'application/pdf',
      checksumSha256: 'sum',
      leadingBytes: new Uint8Array([1, 2]),
    });
    await store.remove('quarantine/one');
    await store.promote('quarantine/one', 'plans/one');
    expect(send).toHaveBeenCalledTimes(4);
  });

  it('returns null only for missing objects [AC-002]', async () => {
    const missing = Object.assign(new Error('missing'), {
      $metadata: { httpStatusCode: 404 },
    });
    const store = createS3AllocationPlanObjectStore({
      bucketName: 'private',
      client: { send: vi.fn().mockRejectedValue(missing) } as never,
    });
    await expect(store.inspect('missing')).resolves.toBeNull();
    const unavailable = createS3AllocationPlanObjectStore({
      bucketName: 'private',
      client: {
        send: vi.fn().mockRejectedValue(new Error('offline')),
      } as never,
    });
    await expect(unavailable.inspect('one')).rejects.toThrow('offline');

    const empty = createS3AllocationPlanObjectStore({
      bucketName: 'private',
      client: {
        send: vi
          .fn()
          .mockResolvedValueOnce({})
          .mockResolvedValueOnce({ Body: undefined }),
      } as never,
    });
    await expect(empty.inspect('empty')).resolves.toMatchObject({
      byteSize: -1,
      leadingBytes: new Uint8Array(),
    });
  });
});
