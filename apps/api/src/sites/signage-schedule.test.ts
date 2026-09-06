import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
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
  id: 'sign',
  signTypeId: 'type',
  code: 'RS.2',
  normalizedCode: 'rs.2',
  quantity: 2,
  location: 'G001',
  content: '',
  comments: '',
  status: 'APPROVED',
  createdAt: now,
  updatedAt: now,
  tenantId: 'tenant',
  siteId: 'site',
};
const type = {
  id: 'type',
  name: 'Regulatory',
  normalizedName: 'regulatory',
  color: 'RED',
  createdAt: now,
  updatedAt: now,
  tenantId: 'tenant',
  siteId: 'site',
  signs: [sign],
};
const makePrisma = () => ({
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
});

describe('signage schedule persistence [site-signage-schedule REQ-002..REQ-017]', () => {
  it('loads scoped groups, totals, permissions, and canonical records', async () => {
    const prisma = makePrisma();
    const feature = createSignageScheduleFeature(
      prisma as unknown as PrismaClient,
    );
    await expect(feature.load(principal, 'site')).resolves.toMatchObject({
      canManageSigns: true,
      signTypes: [{ quantityTotal: 2, signs: [{ code: 'RS.2' }] }],
    });
    await expect(
      feature.createType(principal, 'site', 'Regulatory'),
    ).resolves.toMatchObject({ id: 'type' });
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
        status: 'APPROVED',
      }),
    ).resolves.toMatchObject({ code: 'RS.2' });
    await expect(
      feature.updateSign(principal, 'site', 'sign', {
        field: 'code',
        value: 'RS.3',
        expectedUpdatedAt: now.toISOString(),
      }),
    ).resolves.toMatchObject({ id: 'sign' });
    expect(prisma.sign.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { code: 'RS.3', normalizedCode: 'rs.3' },
      }),
    );
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
        status: 'UNSPECIFIED',
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
        status: 'UNSPECIFIED',
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
