import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { signageScheduleResponseSchema } from '@hansel/contracts';
import {
  createSignageScheduleFeature,
  SignageConflictError,
  SignageForbiddenError,
  SignageNotFoundError,
} from './signage-schedule.js';

const now = new Date('2026-09-06T00:00:00.000Z');
const principal = {
  userId: 'u',
  tenantId: 'tenant',
  membershipId: 'member',
  roleId: 'editor',
  email: 'editor@example.com',
};
const sign = {
  id: '8c238d45-ad70-48bd-917a-416af6daf310',
  signTypeId: 'd9816745-5506-457d-aba9-a11626dcb7a8',
  code: 'RS.2',
  normalizedCode: 'rs.2',
  quantity: 2,
  location: 'G001',
  content: '',
  comments: '',
  createdAt: now,
  updatedAt: now,
  tenantId: 'tenant',
  siteId: 'site',
};
const type = {
  id: 'd9816745-5506-457d-aba9-a11626dcb7a8',
  name: 'Regulatory',
  normalizedName: 'regulatory',
  color: 'RED',
  createdAt: now,
  updatedAt: now,
  tenantId: 'tenant',
  siteId: 'site',
  signs: [sign],
};
const makePrisma = () => {
  const prisma = {
    site: { count: vi.fn().mockResolvedValue(1) },
    signType: {
      findMany: vi.fn().mockResolvedValue([type]),
      findFirst: vi.fn().mockResolvedValue(type),
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue({ id: 'type' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    sign: {
      findFirst: vi.fn().mockResolvedValue(sign),
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue(sign),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    activity: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation(
    (callback: (client: typeof prisma) => Promise<unknown>) => callback(prisma),
  );
  return prisma;
};

describe('signage schedule persistence [site-signage-schedule REQ-002..REQ-017; site-activity-feed-comments REQ-005]', () => {
  it('loads scoped groups, totals, permissions, and canonical records', async () => {
    const prisma = makePrisma();
    const feature = createSignageScheduleFeature(
      prisma as unknown as PrismaClient,
      true,
    );
    const schedule = await feature.load(principal, 'site');
    expect(() => signageScheduleResponseSchema.parse(schedule)).not.toThrow();
    // signage-schedule-remove-status REQ-003: canonical responses omit status.
    expect(schedule.signTypes[0]?.signs[0]).not.toHaveProperty('status');
    expect(schedule).toMatchObject({
      canManageSigns: true,
      signTypes: [{ quantityTotal: 2, signs: [{ code: 'RS.2' }] }],
    });
    await expect(
      feature.createType(principal, 'site', 'Regulatory'),
    ).resolves.toMatchObject({ id: type.id });
    await expect(
      feature.updateType(
        principal,
        'site',
        'type',
        'Safety',
        now.toISOString(),
      ),
    ).resolves.toMatchObject({ name: 'Regulatory' });
    await expect(
      feature.createSign(principal, 'site', 'type', {
        code: 'RS.2',
        quantity: 2,
        location: 'G001',
        content: '',
        comments: '',
      }),
    ).resolves.toMatchObject({ code: 'RS.2' });
    await expect(
      feature.updateSign(principal, 'site', 'sign', {
        field: 'code',
        value: 'RS.3',
        expectedUpdatedAt: now.toISOString(),
      }),
    ).resolves.toMatchObject({ id: sign.id });
    expect(prisma.sign.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { code: 'RS.3', normalizedCode: 'rs.3' },
      }),
    );
    expect(prisma.activity.create).toHaveBeenCalledTimes(4);
    expect(prisma.activity.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        actorMembershipId: 'member',
        kind: 'SIGN_UPDATED',
        siteId: 'site',
        subjectLabel: 'RS.2',
      }),
    });
  });

  it('enforces access, roles, limits, parent scope, conflicts, and missing results', async () => {
    const viewer = { ...principal, roleId: 'viewer' };
    await expect(
      createSignageScheduleFeature(
        makePrisma() as unknown as PrismaClient,
      ).createType(viewer, 'site', 'No'),
    ).rejects.toBeInstanceOf(SignageForbiddenError);
    const missingSite = makePrisma();
    missingSite.site.count.mockResolvedValue(0);
    await expect(
      createSignageScheduleFeature(missingSite as unknown as PrismaClient).load(
        principal,
        'site',
      ),
    ).rejects.toBeInstanceOf(SignageNotFoundError);
    const typeLimit = makePrisma();
    typeLimit.signType.count.mockResolvedValue(100);
    await expect(
      createSignageScheduleFeature(
        typeLimit as unknown as PrismaClient,
      ).createType(principal, 'site', 'No'),
    ).rejects.toThrow();
    const signLimit = makePrisma();
    signLimit.sign.count.mockResolvedValue(5000);
    await expect(
      createSignageScheduleFeature(
        signLimit as unknown as PrismaClient,
      ).createSign(principal, 'site', 'type', {
        code: 'A',
        quantity: 1,
        location: '',
        content: '',
        comments: '',
      }),
    ).rejects.toBeInstanceOf(SignageConflictError);
    const missingType = makePrisma();
    missingType.signType.count.mockResolvedValue(0);
    await expect(
      createSignageScheduleFeature(
        missingType as unknown as PrismaClient,
      ).createSign(principal, 'site', 'type', {
        code: 'A',
        quantity: 1,
        location: '',
        content: '',
        comments: '',
      }),
    ).rejects.toBeInstanceOf(SignageNotFoundError);
    for (const prisma of [makePrisma(), makePrisma()]) {
      prisma.signType.updateMany.mockRejectedValue(new Error('db'));
      await expect(
        createSignageScheduleFeature(
          prisma as unknown as PrismaClient,
        ).updateType(principal, 'site', 'type', 'A', now.toISOString()),
      ).rejects.toBeInstanceOf(SignageConflictError);
      break;
    }
    const stale = makePrisma();
    stale.sign.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      createSignageScheduleFeature(stale as unknown as PrismaClient).updateSign(
        principal,
        'site',
        'sign',
        { field: 'quantity', value: 3, expectedUpdatedAt: now.toISOString() },
      ),
    ).rejects.toBeInstanceOf(SignageConflictError);
    const absent = makePrisma();
    absent.signType.findFirst.mockResolvedValue(null);
    await expect(
      createSignageScheduleFeature(
        absent as unknown as PrismaClient,
      ).createType(principal, 'site', 'A'),
    ).rejects.toThrow();
  });
});
it('site-signage-schedule REQ-002..017: uses current access roles and maps database or missing-record conflicts', async () => {
  const db = makePrisma(),
    api = createSignageScheduleFeature(db as never);
  await api.load({ ...principal, roleId: 'viewer' }, 'site');
  db.sign.create.mockRejectedValueOnce(new Error('offline'));
  await expect(
    api.createSign(principal, 'site', 'type', {
      code: 'A',
      quantity: 1,
      location: '',
      content: '',
      comments: '',
    }),
  ).rejects.toThrow();
  db.sign.updateMany.mockRejectedValueOnce(new Error('offline'));
  await expect(
    api.updateSign(principal, 'site', 'sign', {
      field: 'code',
      value: 'New',
      expectedUpdatedAt: now.toISOString(),
    }),
  ).rejects.toThrow();
  db.sign.findFirst.mockResolvedValueOnce(null);
  await expect(
    api.updateSign(principal, 'site', 'sign', {
      field: 'code',
      value: 'New',
      expectedUpdatedAt: now.toISOString(),
    }),
  ).rejects.toThrow();
  db.signType.updateMany.mockResolvedValueOnce({ count: 0 });
  await expect(
    api.updateType(principal, 'site', 'type', 'New', now.toISOString()),
  ).rejects.toThrow();
});

it('scopes an Owner to the organization without individual Site grants', async () => {
  const db = makePrisma();
  await createSignageScheduleFeature(db as never).load(
    { ...principal, roleId: 'owner' },
    'site',
  );
  expect(db.site.count).toHaveBeenCalledWith({
    where: { id: 'site', tenantId: principal.tenantId },
  });
});
