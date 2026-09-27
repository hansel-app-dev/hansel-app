import { describe, expect, it, vi } from 'vitest';
import {
  AllocationPlanUploadRejectedError,
  AllocationPlansConflictError,
  AllocationPlansForbiddenError,
  AllocationPlansNotFoundError,
  createAllocationPlansFeature,
  type AllocationPlanObjectStore,
  type AllocationPlanStore,
  type PendingAllocationPlanUpload,
} from './allocation-plans.js';

const principal = {
  userId: '00000000-0000-4000-8000-000000000001',
  tenantId: '00000000-0000-4000-8000-000000000002',
  membershipId: '00000000-0000-4000-8000-000000000003',
  roleId: 'owner',
  email: 'owner@example.com',
};
const siteId = '00000000-0000-4000-8000-000000000004';
const upload: PendingAllocationPlanUpload = {
  id: '00000000-0000-4000-8000-000000000005',
  tenantId: principal.tenantId,
  siteId,
  objectKey: 'quarantine/upload',
  filename: 'plan.pdf',
  mediaType: 'application/pdf',
  byteSize: 5,
  checksumSha256: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  expiresAt: new Date('2026-09-06T00:15:00.000Z'),
  status: 'PENDING',
};

function setup(overrides: Partial<AllocationPlanObjectStore> = {}) {
  const canAccess = vi.fn().mockResolvedValue(true);
  const createBatch = vi
    .fn()
    .mockImplementation(
      (input: Parameters<AllocationPlanStore['createBatch']>[0]) =>
        Promise.resolve({
          status: 'created' as const,
          uploads: input.uploads.map((value) => ({
            ...value,
            tenantId: principal.tenantId,
            siteId,
            expiresAt: input.expiresAt,
            status: 'PENDING' as const,
          })),
        }),
    );
  const findUpload = vi.fn().mockResolvedValue(upload);
  const complete = vi.fn().mockResolvedValue({
    id: '00000000-0000-4000-8000-000000000006',
    filename: upload.filename,
    mediaType: upload.mediaType,
    byteSize: upload.byteSize,
    createdAt: '2026-09-06T00:00:00.000Z',
    modifiedAt: '2026-09-06T00:00:00.000Z',
    uploadedBy: 'Nabin Singh',
  });
  const reject = vi.fn().mockResolvedValue(undefined);
  const signPut = vi.fn().mockResolvedValue('https://uploads.example/object');
  const remove = vi.fn().mockResolvedValue(undefined);
  const promote = vi.fn().mockResolvedValue(undefined);
  const store: AllocationPlanStore = {
    canAccess,
    list: vi.fn().mockResolvedValue([]),
    findContent: vi.fn().mockResolvedValue({
      objectKey: 'plans/one',
      mediaType: 'image/png',
    }),
    createBatch,
    findUpload,
    complete,
    reject,
  };
  const objects: AllocationPlanObjectStore = {
    signPut,
    inspect: vi.fn().mockResolvedValue({
      byteSize: 5,
      mediaType: 'application/pdf',
      checksumSha256: upload.checksumSha256,
      leadingBytes: new TextEncoder().encode('%PDF-'),
    }),
    remove,
    promote,
    read: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    ...overrides,
  };
  return {
    store,
    objects,
    spies: {
      canAccess,
      createBatch,
      findUpload,
      complete,
      reject,
      signPut,
      remove,
      promote,
    },
    feature: createAllocationPlansFeature({
      store,
      objects,
      createId: () => upload.id,
      digest: (value) => `digest:${value}`,
      now: () => new Date('2026-09-06T00:00:00.000Z'),
    }),
  };
}

describe('Allocation Plans [site-allocation-plans-add REQ-001..REQ-019]', () => {
  it('returns bounded finalized content without exposing its object key [site-allocation-plan-preview REQ-002..REQ-005]', async () => {
    const { feature } = setup();
    await expect(
      feature.content(
        principal,
        siteId,
        '00000000-0000-4000-8000-000000000006',
      ),
    ).resolves.toEqual({
      mediaType: 'image/png',
      bytes: new Uint8Array([1, 2, 3]),
    });
  });

  it('rejects missing, unsupported, empty, and oversized preview content [site-allocation-plan-preview AC-003]', async () => {
    const missing = setup();
    missing.store.findContent = vi.fn().mockResolvedValue(null);
    await expect(
      missing.feature.content(principal, siteId, upload.id),
    ).rejects.toBeInstanceOf(AllocationPlansNotFoundError);
    const unsupported = setup();
    unsupported.store.findContent = vi
      .fn()
      .mockResolvedValue({ objectKey: 'plans/x', mediaType: 'text/html' });
    await expect(
      unsupported.feature.content(principal, siteId, upload.id),
    ).rejects.toBeInstanceOf(AllocationPlanUploadRejectedError);
    for (const bytes of [new Uint8Array(), new Uint8Array(5_242_881)]) {
      const invalid = setup({ read: vi.fn().mockResolvedValue(bytes) });
      await expect(
        invalid.feature.content(principal, siteId, upload.id),
      ).rejects.toBeInstanceOf(AllocationPlanUploadRejectedError);
    }
  });
  it('creates a private upload intent and finalizes verified PDF bytes [AC-001]', async () => {
    const { feature, spies } = setup();
    const batch = await feature.createBatch(principal, siteId, {
      idempotencyKey: '12345678901234567890123456789012',
      files: [
        {
          filename: 'plan.pdf',
          mediaType: 'application/pdf',
          byteSize: 5,
          checksumSha256: upload.checksumSha256,
        },
      ],
    });
    expect(batch.uploads[0]).toMatchObject({
      uploadId: upload.id,
      uploadUrl: 'https://uploads.example/object',
    });
    expect(spies.signPut).toHaveBeenCalledWith(
      expect.objectContaining({ expiresInSeconds: 900 }),
    );
    await expect(
      feature.finalize(principal, siteId, upload.id),
    ).resolves.toMatchObject({
      plan: { filename: 'plan.pdf' },
    });
    expect(spies.promote).toHaveBeenCalledWith(
      upload.objectKey,
      `plans/${upload.id}`,
    );
  });

  it('rejects duplicate files and unauthorized mutations [AC-002, AC-003]', async () => {
    const { feature } = setup();
    const file = {
      filename: 'plan.pdf',
      mediaType: 'application/pdf' as const,
      byteSize: 5,
      checksumSha256: upload.checksumSha256,
    };
    await expect(
      feature.createBatch(principal, siteId, {
        idempotencyKey: '12345678901234567890123456789012',
        files: [file, file],
      }),
    ).rejects.toBeInstanceOf(AllocationPlanUploadRejectedError);
    await expect(
      feature.createBatch({ ...principal, roleId: 'viewer' }, siteId, {
        idempotencyKey: '12345678901234567890123456789012',
        files: [file],
      }),
    ).rejects.toBeInstanceOf(AllocationPlansForbiddenError);
  });

  it('removes bytes that fail authoritative verification [AC-002, AC-005]', async () => {
    const { feature, spies } = setup({
      inspect: vi.fn().mockResolvedValue({
        byteSize: 5,
        mediaType: 'application/pdf',
        checksumSha256: upload.checksumSha256,
        leadingBytes: new TextEncoder().encode('HTML!'),
      }),
    });
    await expect(
      feature.finalize(principal, siteId, upload.id),
    ).rejects.toBeInstanceOf(AllocationPlanUploadRejectedError);
    expect(spies.reject).toHaveBeenCalledWith(upload.id, 'verification_failed');
    expect(spies.remove).toHaveBeenCalledWith(upload.objectKey);
  });

  it('lists by tenant access and reports mutation store decisions', async () => {
    const allowed = setup();
    await expect(allowed.feature.list(principal, siteId)).resolves.toEqual({
      canAddPlans: true,
      plans: [],
    });
    await expect(
      allowed.feature.list({ ...principal, roleId: 'viewer' }, siteId),
    ).resolves.toEqual({ canAddPlans: false, plans: [] });

    const denied = setup();
    denied.spies.canAccess.mockResolvedValue(false);
    await expect(denied.feature.list(principal, siteId)).rejects.toBeInstanceOf(
      AllocationPlansNotFoundError,
    );

    const file = {
      filename: 'plan.pdf',
      mediaType: 'application/pdf' as const,
      byteSize: 5,
      checksumSha256: upload.checksumSha256,
    };
    for (const [status, error] of [
      ['conflict', AllocationPlansConflictError],
      ['forbidden', AllocationPlansForbiddenError],
    ] as const) {
      const fixture = setup();
      fixture.spies.createBatch.mockResolvedValue({ status });
      await expect(
        fixture.feature.createBatch(principal, siteId, {
          idempotencyKey: '12345678901234567890123456789012',
          files: [file],
        }),
      ).rejects.toBeInstanceOf(error);
    }
  });

  it('covers idempotent, expired, missing, and failed finalization paths', async () => {
    const plan = await setup().spies.complete(principal, upload, 'plans/x');
    for (const candidate of [
      null,
      { ...upload, status: 'REJECTED' as const },
      { ...upload, expiresAt: new Date('2026-09-05T00:00:00.000Z') },
    ]) {
      const fixture = setup();
      fixture.spies.findUpload.mockResolvedValue(candidate);
      await expect(
        fixture.feature.finalize(principal, siteId, upload.id),
      ).rejects.toBeInstanceOf(
        candidate === null
          ? AllocationPlansNotFoundError
          : AllocationPlanUploadRejectedError,
      );
    }
    const completed = setup();
    completed.spies.findUpload.mockResolvedValue({
      ...upload,
      status: 'COMPLETED',
      plan,
    });
    await expect(
      completed.feature.finalize(principal, siteId, upload.id),
    ).resolves.toEqual({ plan });

    const failed = setup();
    failed.spies.complete.mockRejectedValue(new Error('db failed'));
    await expect(
      failed.feature.finalize(principal, siteId, upload.id),
    ).rejects.toThrow('db failed');
    expect(failed.spies.remove).toHaveBeenCalledWith(`plans/${upload.id}`);
  });

  it('rejects absent or mismatched objects and accepts image signatures', async () => {
    const mismatches = [
      null,
      {
        byteSize: 4,
        mediaType: upload.mediaType,
        checksumSha256: upload.checksumSha256,
        leadingBytes: new TextEncoder().encode('%PDF-'),
      },
      {
        byteSize: 5,
        mediaType: 'image/png',
        checksumSha256: upload.checksumSha256,
        leadingBytes: new TextEncoder().encode('%PDF-'),
      },
      {
        byteSize: 5,
        mediaType: upload.mediaType,
        checksumSha256: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=',
        leadingBytes: new TextEncoder().encode('%PDF-'),
      },
    ];
    for (const object of mismatches) {
      const fixture = setup({ inspect: vi.fn().mockResolvedValue(object) });
      await expect(
        fixture.feature.finalize(principal, siteId, upload.id),
      ).rejects.toBeInstanceOf(AllocationPlanUploadRejectedError);
    }
    for (const [mediaType, leadingBytes] of [
      ['image/png', new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
      ['image/jpeg', new Uint8Array([255, 216])],
    ] as const) {
      const candidate = { ...upload, mediaType };
      const fixture = setup({
        inspect: vi.fn().mockResolvedValue({
          byteSize: 5,
          mediaType,
          checksumSha256: upload.checksumSha256,
          leadingBytes,
        }),
      });
      fixture.spies.findUpload.mockResolvedValue(candidate);
      await expect(
        fixture.feature.finalize(principal, siteId, upload.id),
      ).resolves.toBeDefined();
    }
  });
});
it('allocation-plan-multiple-files REQ-001,008: binds grouped draft batches and rejects finalized or expired replay', async () => {
  const s = setup(),
    input = {
      idempotencyKey: 'k'.repeat(32),
      files: [
        {
          filename: upload.filename,
          mediaType: upload.mediaType,
          byteSize: upload.byteSize,
          checksumSha256: upload.checksumSha256,
        },
      ],
    };
  await s.feature.createBatch(principal, siteId, input, true);
  for (const value of [
    { ...upload, status: 'COMPLETED' },
    { ...upload, expiresAt: new Date(0) },
  ]) {
    s.spies.createBatch.mockResolvedValueOnce({
      status: 'replayed',
      uploads: [value],
    });
    await expect(
      s.feature.createBatch(principal, siteId, input, true),
    ).rejects.toThrow();
  }
  s.spies.findUpload.mockResolvedValueOnce({ ...upload, grouped: true });
  await expect(
    s.feature.finalize(principal, siteId, upload.id),
  ).rejects.toThrow();
  await s.feature.content(principal, siteId, upload.id, upload.id);
});
