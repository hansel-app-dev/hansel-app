import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { createAllocationPlanDraftsFeature } from './allocation-plan-drafts.js';

const principal = {
  tenantId: '00000000-0000-4000-8000-000000000001',
  membershipId: '00000000-0000-4000-8000-000000000002',
  userId: '00000000-0000-4000-8000-000000000003',
  roleId: 'owner',
  email: 'owner@example.test',
};
const id = '00000000-0000-4000-8000-000000000004';
const now = new Date('2026-09-10T00:00:00Z');
const file = {
  id,
  batchId: 'batch',
  status: 'PENDING',
  verifiedAt: null,
  objectKey: `quarantine/${id}`,
  filename: 'plan.pdf',
  mediaType: 'application/pdf',
  byteSize: 5,
  checksumSha256: 'checksum',
  expiresAt: new Date(now.getTime() + 900_000),
};
function fixture() {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    membership: { findUnique: vi.fn().mockResolvedValue({ ...principal }) },
    site: { count: vi.fn().mockResolvedValue(1) },
    allocationPlanUpload: {
      findFirst: vi.fn().mockResolvedValue(file),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    allocationPlan: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    activity: { create: vi.fn() },
  };
  const prisma = {
    ...tx,
    $transaction: vi.fn((work: (transaction: typeof tx) => unknown) =>
      work(tx),
    ),
  };
  const objects = {
    signPut: vi.fn(),
    inspect: vi.fn().mockResolvedValue({
      byteSize: 5,
      mediaType: 'application/pdf',
      checksumSha256: 'checksum',
      leadingBytes: new TextEncoder().encode('%PDF-'),
    }),
    promote: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    read: vi.fn(),
  };
  const feature = createAllocationPlanDraftsFeature({
    prisma: prisma as unknown as PrismaClient,
    objects,
    digest: (value) => value,
    now: () => now,
  });
  return { feature, tx, objects };
}
describe('allocation-plan-multiple-files REQ-001, REQ-008, REQ-010', () => {
  it('verifies a file without a plan or Activity, then replays without copying again', async () => {
    const { feature, tx, objects } = fixture();
    await expect(feature.verify(principal, id, id)).resolves.toEqual({
      uploadId: id,
      verified: true,
    });
    expect(tx.allocationPlan.create).not.toHaveBeenCalled();
    expect(tx.activity.create).not.toHaveBeenCalled();
    tx.allocationPlanUpload.findFirst.mockResolvedValue({
      ...file,
      verifiedAt: now,
    });
    await feature.verify(principal, id, id);
    expect(objects.promote).toHaveBeenCalledOnce();
  });
  it('persists rejection for bad signature instead of making a plan', async () => {
    const { feature, tx, objects } = fixture();
    objects.inspect.mockResolvedValue({
      byteSize: 5,
      mediaType: 'application/pdf',
      checksumSha256: 'checksum',
      leadingBytes: new Uint8Array(5),
    });
    await expect(feature.verify(principal, id, id)).rejects.toThrow();
    expect(tx.allocationPlanUpload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'REJECTED', rejectionCode: 'verification_failed' },
      }),
    );
    expect(objects.promote).not.toHaveBeenCalled();
  });
  it('rejects revoked roles and inaccessible sites before touching bytes', async () => {
    const { feature, tx, objects } = fixture();
    tx.membership.findUnique.mockResolvedValue({
      ...principal,
      roleId: 'viewer',
    });
    await expect(feature.verify(principal, id, id)).rejects.toThrow();
    tx.membership.findUnique.mockResolvedValue(principal);
    tx.site.count.mockResolvedValue(0);
    await expect(feature.verify(principal, id, id)).rejects.toThrow();
    expect(objects.inspect).not.toHaveBeenCalled();
  });
  it('rejects missing, expired and foreign files before committing', async () => {
    const { feature, tx } = fixture();
    tx.allocationPlanUpload.findFirst.mockResolvedValue(null);
    await expect(feature.verify(principal, id, id)).rejects.toThrow();
    tx.allocationPlanUpload.findFirst.mockResolvedValue({
      ...file,
      expiresAt: now,
    });
    await expect(feature.verify(principal, id, id)).rejects.toThrow();
    await expect(
      feature.commit(principal, id, {
        name: 'Plan',
        uploadIds: [id],
        idempotencyKey: 'k'.repeat(32),
      }),
    ).rejects.toThrow();
    expect(tx.allocationPlan.create).not.toHaveBeenCalled();
  });
  it('never cleans a file attached by a racing commit and retries failed deletion', async () => {
    const { feature, tx, objects } = fixture();
    tx.allocationPlanUpload.findMany.mockResolvedValue([file]);
    tx.allocationPlanUpload.updateMany.mockResolvedValueOnce({ count: 0 });
    await feature.cleanup();
    expect(objects.remove).not.toHaveBeenCalled();
    objects.remove.mockRejectedValueOnce(new Error('offline'));
    await expect(feature.cleanup()).rejects.toThrow('offline');
    await feature.cleanup();
    expect(objects.remove).toHaveBeenCalledWith(`plans/${id}`);
    expect(tx.allocationPlanUpload.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { rejectionCode: 'cleaned' } }),
    );
  });
});
it('allocation-plan-multiple-files REQ-008,010: commits verified files once and records optional Activity', async () => {
  const s = fixture(),
    input = { name: 'Plan', uploadIds: [id], idempotencyKey: 'k'.repeat(32) };
  const plan = {
    id,
    name: 'Plan',
    filename: null,
    mediaType: null,
    byteSize: null,
    files: [
      { id, filename: 'plan.pdf', mediaType: 'application/pdf', byteSize: 5 },
    ],
    createdAt: now,
    updatedAt: now,
    uploadedBy: { email: 'owner@example.com', personalProfile: null },
  };
  s.tx.allocationPlanUpload.findMany.mockResolvedValue([file]);
  s.tx.allocationPlan.create.mockResolvedValue({ id });
  s.tx.allocationPlan.findUniqueOrThrow.mockResolvedValue(plan);
  expect(await s.feature.commit(principal, id, input)).toMatchObject({
    plan: { name: 'Plan' },
  });
  const creation = s.tx.allocationPlan.create.mock.calls[0]?.[0];
  if (!creation) throw new Error('Expected creation digest');
  s.tx.allocationPlan.findUnique.mockResolvedValueOnce({
    ...plan,
    ...creation.data,
  });
  await expect(s.feature.commit(principal, id, input)).resolves.toMatchObject({
    plan: { id },
  });
  s.tx.allocationPlan.findUnique.mockResolvedValueOnce({
    ...plan,
    creationDigest: 'changed',
  });
  await expect(s.feature.commit(principal, id, input)).rejects.toThrow();
  const api = createAllocationPlanDraftsFeature({
    prisma: {
      $transaction: (work: (value: typeof s.tx) => Promise<unknown>) =>
        work(s.tx),
    } as never,
    objects: s.objects,
    digest: (value) => value,
    now: () => now,
    activityEnabled: true,
  });
  await api.commit(principal, id, input);
  expect(s.tx.activity.create).toHaveBeenCalledOnce();
});

it('validates grouped batch requests before creating any upload intent', async () => {
  const { feature, objects } = fixture();
  await expect(
    feature.createBatch(principal, id, {
      files: [],
      idempotencyKey: 'invalid',
    }),
  ).rejects.toThrow();
  expect(objects.signPut).not.toHaveBeenCalled();
});

it('uses the current clock by default when rejecting expired upload drafts', async () => {
  const { tx, objects } = fixture();
  const feature = createAllocationPlanDraftsFeature({
    prisma: {
      ...tx,
      $transaction: (work: (db: typeof tx) => Promise<unknown>) => work(tx),
    } as never,
    objects,
    digest: (value) => value,
  });
  await expect(feature.verify(principal, id, id)).rejects.toThrow();
  expect(objects.inspect).not.toHaveBeenCalled();
});
