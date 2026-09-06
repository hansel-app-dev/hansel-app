import { describe, expect, it, vi } from 'vitest';
import { createPrismaAllocationPlanStore } from './prisma-allocation-plan-store.js';

const principal = {
  userId: 'u',
  tenantId: 't',
  membershipId: 'm',
  roleId: 'owner',
  email: 'owner@example.com',
};
const now = new Date('2026-09-06T00:00:00.000Z');
const plan = {
  id: 'p',
  filename: 'plan.pdf',
  mediaType: 'application/pdf',
  byteSize: 5,
  createdAt: now,
  updatedAt: now,
  uploadedBy: {
    email: 'owner@example.com',
    personalProfile: { firstName: 'Nabin', lastName: 'Singh' },
  },
};
const upload = {
  id: 'u1',
  batchId: 'b',
  tenantId: 't',
  siteId: 's',
  uploadedById: 'u',
  allocationPlanId: null,
  objectKey: 'quarantine/u1',
  filename: 'plan.pdf',
  mediaType: 'application/pdf',
  byteSize: 5,
  checksumSha256: 'sum',
  status: 'PENDING',
  rejectionCode: null,
  expiresAt: new Date('2026-09-06T00:15:00.000Z'),
  createdAt: now,
  updatedAt: now,
  allocationPlan: null,
};

function fixture() {
  const tx = {
    allocationPlanUploadBatch: { findUnique: vi.fn(), create: vi.fn() },
    membership: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ userId: 'u', tenantId: 't', roleId: 'owner' }),
    },
    site: { count: vi.fn().mockResolvedValue(1) },
    allocationPlanUpload: { findFirst: vi.fn(), update: vi.fn() },
    allocationPlan: { create: vi.fn().mockResolvedValue(plan) },
  };
  const prisma = {
    site: { count: vi.fn().mockResolvedValue(1) },
    allocationPlan: { findMany: vi.fn().mockResolvedValue([plan]) },
    allocationPlanUpload: {
      findFirst: vi.fn().mockResolvedValue(upload),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn((callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
  };
  return {
    tx,
    prisma,
    store: createPrismaAllocationPlanStore(prisma as never),
  };
}

describe('Prisma Allocation Plan store [site-allocation-plans-add REQ-001, REQ-006..REQ-018]', () => {
  it('scopes access, lists display metadata, finds and rejects uploads [AC-001, AC-003]', async () => {
    const { store, prisma } = fixture();
    await expect(store.canAccess(principal, 's')).resolves.toBe(true);
    await expect(
      store.canAccess({ ...principal, roleId: 'viewer' }, 's'),
    ).resolves.toBe(true);
    await expect(store.list(principal, 's')).resolves.toEqual([
      {
        id: 'p',
        filename: 'plan.pdf',
        mediaType: 'application/pdf',
        byteSize: 5,
        createdAt: now.toISOString(),
        modifiedAt: now.toISOString(),
        uploadedBy: 'Nabin Singh',
      },
    ]);
    await expect(store.findUpload(principal, 's', 'u1')).resolves.toMatchObject(
      { id: 'u1' },
    );
    prisma.allocationPlanUpload.findFirst.mockResolvedValueOnce({
      ...upload,
      allocationPlan: plan,
    });
    await expect(store.findUpload(principal, 's', 'u1')).resolves.toMatchObject(
      {
        plan: { id: 'p' },
      },
    );
    prisma.allocationPlanUpload.findFirst.mockResolvedValueOnce(null);
    await expect(
      store.findUpload(principal, 's', 'absent'),
    ).resolves.toBeNull();
    await store.reject('u1', 'bad');
    expect(prisma.allocationPlanUpload.updateMany).toHaveBeenCalled();
  });

  it('creates, replays, conflicts, and authorizes batches [AC-003, AC-004]', async () => {
    const input = {
      principal,
      siteId: 's',
      request: { idempotencyKey: 'x'.repeat(32), files: [] },
      requestDigest: 'request',
      keyDigest: 'key',
      expiresAt: upload.expiresAt,
      uploads: [
        {
          id: 'u1',
          objectKey: upload.objectKey,
          filename: upload.filename,
          mediaType: 'application/pdf' as const,
          byteSize: 5,
          checksumSha256: 'sum',
        },
      ],
    };
    const created = fixture();
    created.tx.allocationPlanUploadBatch.findUnique.mockResolvedValue(null);
    created.tx.allocationPlanUploadBatch.create.mockResolvedValue({
      uploads: [upload],
    });
    await expect(created.store.createBatch(input)).resolves.toMatchObject({
      status: 'created',
    });
    const replay = fixture();
    replay.tx.allocationPlanUploadBatch.findUnique.mockResolvedValue({
      requestDigest: 'request',
      uploads: [upload],
    });
    await expect(replay.store.createBatch(input)).resolves.toMatchObject({
      status: 'replayed',
    });
    replay.tx.allocationPlanUploadBatch.findUnique.mockResolvedValue({
      requestDigest: 'other',
      uploads: [],
    });
    await expect(replay.store.createBatch(input)).resolves.toEqual({
      status: 'conflict',
    });
    const forbidden = fixture();
    forbidden.tx.allocationPlanUploadBatch.findUnique.mockResolvedValue(null);
    forbidden.tx.membership.findUnique.mockResolvedValue(null);
    await expect(forbidden.store.createBatch(input)).resolves.toEqual({
      status: 'forbidden',
    });
    forbidden.tx.membership.findUnique.mockResolvedValue({
      userId: 'u',
      tenantId: 't',
      roleId: 'owner',
    });
    forbidden.tx.site.count.mockResolvedValue(0);
    await expect(forbidden.store.createBatch(input)).resolves.toEqual({
      status: 'forbidden',
    });
  });

  it('finalizes once and returns the existing result on retry [AC-004]', async () => {
    const first = fixture();
    first.tx.allocationPlanUpload.findFirst.mockResolvedValue(upload);
    await expect(
      first.store.complete(principal, upload as never, 'plans/u1'),
    ).resolves.toMatchObject({ id: 'p' });
    expect(first.tx.allocationPlanUpload.update).toHaveBeenCalled();
    const replay = fixture();
    replay.tx.allocationPlanUpload.findFirst.mockResolvedValue({
      ...upload,
      status: 'COMPLETED',
      allocationPlan: {
        ...plan,
        uploadedBy: { email: 'owner@example.com', personalProfile: null },
      },
    });
    await expect(
      replay.store.complete(principal, upload as never, 'plans/u1'),
    ).resolves.toMatchObject({ uploadedBy: 'owner' });
    const rejected = fixture();
    rejected.tx.allocationPlanUpload.findFirst.mockResolvedValue({
      ...upload,
      status: 'REJECTED',
    });
    await expect(
      rejected.store.complete(principal, upload as never, 'plans/u1'),
    ).rejects.toThrow('upload_not_pending');
  });
});
