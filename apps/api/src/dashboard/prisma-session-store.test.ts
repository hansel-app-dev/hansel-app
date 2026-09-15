import { describe, expect, it, vi } from 'vitest';
import { createPrismaDashboardSessionStore } from './prisma-session-store.js';

const now = new Date('2026-08-29T00:00:00.000Z');
const future = new Date('2026-08-29T00:15:00.000Z');

describe('Prisma dashboard session store [dashboard-home REQ-007, REQ-010, REQ-011]', () => {
  it('revokes only active families represented by credential digests [dashboard-logout REQ-005, REQ-007]', async () => {
    const prisma = {
      applicationSessionCredential: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { familyId: 'family-a' },
            { familyId: 'family-a' },
            { familyId: 'family-b' },
          ]),
      },
      applicationSessionFamily: {
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const store = createPrismaDashboardSessionStore(prisma as never, vi.fn());

    await expect(
      store.revokeFamilies({
        credentialDigests: ['access-digest', 'refresh-digest'],
        now,
      }),
    ).resolves.toBeUndefined();
    expect(prisma.applicationSessionCredential.findMany).toHaveBeenCalledWith({
      where: {
        credentialDigest: { in: ['access-digest', 'refresh-digest'] },
      },
      select: { familyId: true },
    });
    expect(prisma.applicationSessionFamily.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['family-a', 'family-b'] }, revokedAt: null },
      data: { revokedAt: now, revocationReason: 'user_logout' },
    });
  });

  it('does nothing when logout credentials represent no family [dashboard-logout REQ-007]', async () => {
    const prisma = {
      applicationSessionCredential: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      applicationSessionFamily: { updateMany: vi.fn() },
    };
    const store = createPrismaDashboardSessionStore(prisma as never, vi.fn());

    await expect(
      store.revokeFamilies({ credentialDigests: ['unknown'], now }),
    ).resolves.toBeUndefined();
    expect(prisma.applicationSessionFamily.updateMany).not.toHaveBeenCalled();
  });

  it('authorizes a current access credential through its active tenant membership', async () => {
    const prisma = {
      applicationSessionCredential: {
        findUnique: vi.fn().mockResolvedValue({
          kind: 'ACCESS',
          expiresAt: future,
          consumedAt: null,
          family: {
            userId: 'user-id',
            tenantId: 'tenant-id',
            absoluteExpiresAt: new Date('2026-09-28T00:00:00.000Z'),
            revokedAt: null,
            user: {
              email: 'owner@example.com',
              personalProfile: { firstName: 'Nabin', lastName: 'Singh' },
            },
          },
        }),
      },
      membership: {
        findUnique: vi.fn().mockResolvedValue({
          roleId: 'owner',
          tenant: {
            name: 'Hansel',
            memberships: [{ user: { planSelection: { planId: 'free' } } }],
          },
        }),
      },
    };
    const store = createPrismaDashboardSessionStore(prisma as never, vi.fn());

    await expect(
      store.authorizeAccess({ credentialDigest: 'digest', now }),
    ).resolves.toEqual({
      firstName: 'Nabin',
      lastName: 'Singh',
      roleId: 'owner',
      email: 'owner@example.com',
      organizationName: 'Hansel',
      planId: 'free',
    });
    expect(prisma.membership.findUnique).toHaveBeenCalledWith({
      where: {
        userId_tenantId: { userId: 'user-id', tenantId: 'tenant-id' },
      },
      select: expect.objectContaining({
        roleId: true,
        tenant: expect.anything(),
      }),
    });
  });

  it('rejects invalid access credentials and removed memberships generically', async () => {
    const valid = {
      kind: 'ACCESS',
      expiresAt: future,
      consumedAt: null,
      family: {
        userId: 'user-id',
        tenantId: 'tenant-id',
        absoluteExpiresAt: new Date('2026-09-28T00:00:00.000Z'),
        revokedAt: null,
        user: {
          personalProfile: { firstName: 'Nabin', lastName: 'Singh' },
        },
      },
    };
    const cases = [
      null,
      { ...valid, kind: 'REFRESH' },
      { ...valid, consumedAt: now },
      { ...valid, expiresAt: now },
      { ...valid, family: { ...valid.family, revokedAt: now } },
      {
        ...valid,
        family: { ...valid.family, absoluteExpiresAt: now },
      },
      {
        ...valid,
        family: { ...valid.family, user: { personalProfile: null } },
      },
    ];
    for (const credential of cases) {
      const prisma = {
        applicationSessionCredential: {
          findUnique: vi.fn().mockResolvedValue(credential),
        },
        membership: { findUnique: vi.fn() },
      };
      await expect(
        createPrismaDashboardSessionStore(
          prisma as never,
          vi.fn(),
        ).authorizeAccess({
          credentialDigest: 'digest',
          now,
        }),
      ).resolves.toBeNull();
      expect(prisma.membership.findUnique).not.toHaveBeenCalled();
    }
    const missingMembership = {
      applicationSessionCredential: {
        findUnique: vi.fn().mockResolvedValue(valid),
      },
      membership: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    const recordEvent = vi.fn();
    await expect(
      createPrismaDashboardSessionStore(
        missingMembership as never,
        recordEvent,
      ).authorizeAccess({ credentialDigest: 'digest', now }),
    ).resolves.toBeNull();
    expect(recordEvent).toHaveBeenCalledWith('dashboard_membership_rejected');
  });

  it('atomically consumes and replaces a valid refresh credential', async () => {
    const transaction = {
      applicationSessionCredential: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'refresh-id',
          kind: 'REFRESH',
          expiresAt: new Date('2026-09-28T00:00:00.000Z'),
          consumedAt: null,
          family: {
            id: 'family-id',
            userId: 'user-id',
            tenantId: 'tenant-id',
            absoluteExpiresAt: new Date('2026-09-20T00:00:00.000Z'),
            revokedAt: null,
            user: {
              personalProfile: { firstName: 'Nabin', lastName: 'Singh' },
            },
          },
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        createMany: vi.fn(),
      },
      applicationSessionFamily: { update: vi.fn() },
      membership: {
        findUnique: vi.fn().mockResolvedValue({ roleId: 'owner' }),
      },
    };
    const prisma = {
      $transaction: vi.fn(
        async (callback: (value: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    };
    const store = createPrismaDashboardSessionStore(prisma as never, vi.fn());

    await expect(
      store.rotateRefresh({
        credentialDigest: 'old-refresh',
        accessCredentialDigest: 'new-access',
        refreshCredentialDigest: 'new-refresh',
        now,
        accessExpiresAt: future,
        refreshExpiresAt: new Date('2026-09-28T00:00:00.000Z'),
      }),
    ).resolves.toEqual({
      status: 'accepted',
      viewer: { firstName: 'Nabin', lastName: 'Singh', roleId: 'owner' },
    });
    expect(
      transaction.applicationSessionCredential.updateMany,
    ).toHaveBeenCalledWith({
      where: { id: 'refresh-id', consumedAt: null },
      data: { consumedAt: now },
    });
    expect(
      transaction.applicationSessionCredential.createMany,
    ).toHaveBeenCalledWith({
      data: [
        {
          familyId: 'family-id',
          kind: 'ACCESS',
          credentialDigest: 'new-access',
          expiresAt: future,
        },
        {
          familyId: 'family-id',
          kind: 'REFRESH',
          credentialDigest: 'new-refresh',
          expiresAt: new Date('2026-09-20T00:00:00.000Z'),
        },
      ],
    });
    await expect(
      store.rotateRefresh({
        credentialDigest: 'old-refresh',
        accessCredentialDigest: 'later-access',
        refreshCredentialDigest: 'earlier-refresh',
        now,
        accessExpiresAt: new Date('2026-09-21T00:00:00.000Z'),
        refreshExpiresAt: new Date('2026-09-10T00:00:00.000Z'),
      }),
    ).resolves.toMatchObject({ status: 'accepted' });
    expect(
      transaction.applicationSessionCredential.createMany,
    ).toHaveBeenLastCalledWith({
      data: [
        {
          familyId: 'family-id',
          kind: 'ACCESS',
          credentialDigest: 'later-access',
          expiresAt: new Date('2026-09-20T00:00:00.000Z'),
        },
        {
          familyId: 'family-id',
          kind: 'REFRESH',
          credentialDigest: 'earlier-refresh',
          expiresAt: new Date('2026-09-10T00:00:00.000Z'),
        },
      ],
    });
  });

  it('rejects invalid refresh credentials and removed memberships generically', async () => {
    const valid = {
      id: 'refresh-id',
      kind: 'REFRESH',
      expiresAt: new Date('2026-09-20T00:00:00.000Z'),
      consumedAt: null,
      family: {
        id: 'family-id',
        userId: 'user-id',
        tenantId: 'tenant-id',
        absoluteExpiresAt: new Date('2026-09-20T00:00:00.000Z'),
        revokedAt: null,
        user: {
          personalProfile: { firstName: 'Nabin', lastName: 'Singh' },
        },
      },
    };
    const input = {
      credentialDigest: 'refresh',
      accessCredentialDigest: 'access',
      refreshCredentialDigest: 'replacement',
      now,
      accessExpiresAt: future,
      refreshExpiresAt: new Date('2026-09-10T00:00:00.000Z'),
    };
    const cases = [
      null,
      { ...valid, kind: 'ACCESS' },
      { ...valid, expiresAt: now },
      { ...valid, family: { ...valid.family, revokedAt: now } },
      { ...valid, family: { ...valid.family, absoluteExpiresAt: now } },
      {
        ...valid,
        family: { ...valid.family, user: { personalProfile: null } },
      },
    ];
    for (const credential of cases) {
      const transaction = {
        applicationSessionCredential: {
          findUnique: vi.fn().mockResolvedValue(credential),
          updateMany: vi.fn(),
          createMany: vi.fn(),
        },
        applicationSessionFamily: { update: vi.fn() },
        membership: { findUnique: vi.fn() },
      };
      const store = createPrismaDashboardSessionStore(
        {
          $transaction: vi.fn(
            async (callback: (value: typeof transaction) => Promise<unknown>) =>
              callback(transaction),
          ),
        } as never,
        vi.fn(),
      );
      await expect(store.rotateRefresh(input)).resolves.toEqual({
        status: 'rejected',
      });
      expect(transaction.membership.findUnique).not.toHaveBeenCalled();
    }

    const transaction = {
      applicationSessionCredential: {
        findUnique: vi.fn().mockResolvedValue(valid),
        updateMany: vi.fn(),
        createMany: vi.fn(),
      },
      applicationSessionFamily: { update: vi.fn() },
      membership: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    const recordEvent = vi.fn();
    const store = createPrismaDashboardSessionStore(
      {
        $transaction: vi.fn(
          async (callback: (value: typeof transaction) => Promise<unknown>) =>
            callback(transaction),
        ),
      } as never,
      recordEvent,
    );
    await expect(store.rotateRefresh(input)).resolves.toEqual({
      status: 'rejected',
    });
    expect(
      transaction.applicationSessionCredential.updateMany,
    ).not.toHaveBeenCalled();
    expect(recordEvent).toHaveBeenCalledWith('dashboard_membership_rejected');
  });

  it('revokes a family when a refresh credential is reused or loses the race', async () => {
    const credential = {
      id: 'refresh-id',
      kind: 'REFRESH',
      expiresAt: new Date('2026-09-28T00:00:00.000Z'),
      consumedAt: now,
      family: {
        id: 'family-id',
        userId: 'user-id',
        tenantId: 'tenant-id',
        absoluteExpiresAt: new Date('2026-09-20T00:00:00.000Z'),
        revokedAt: null,
        user: {
          personalProfile: { firstName: 'Nabin', lastName: 'Singh' },
        },
      },
    };
    const make = (consumedAt: Date | null, count: number) => {
      const transaction = {
        applicationSessionCredential: {
          findUnique: vi.fn().mockResolvedValue({ ...credential, consumedAt }),
          updateMany: vi.fn().mockResolvedValue({ count }),
          createMany: vi.fn(),
        },
        applicationSessionFamily: { update: vi.fn() },
        membership: {
          findUnique: vi.fn().mockResolvedValue({ roleId: 'owner' }),
        },
      };
      const recordEvent = vi.fn();
      return {
        transaction,
        recordEvent,
        store: createPrismaDashboardSessionStore(
          {
            $transaction: vi.fn(
              async (
                callback: (value: typeof transaction) => Promise<unknown>,
              ) => callback(transaction),
            ),
          } as never,
          recordEvent,
        ),
      };
    };
    const input = {
      credentialDigest: 'old-refresh',
      accessCredentialDigest: 'new-access',
      refreshCredentialDigest: 'new-refresh',
      now,
      accessExpiresAt: future,
      refreshExpiresAt: new Date('2026-09-10T00:00:00.000Z'),
    };
    for (const scenario of [make(now, 1), make(null, 0)]) {
      await expect(scenario.store.rotateRefresh(input)).resolves.toEqual({
        status: 'rejected',
      });
      expect(
        scenario.transaction.applicationSessionFamily.update,
      ).toHaveBeenCalledWith({
        where: { id: 'family-id' },
        data: { revokedAt: now, revocationReason: 'refresh_reuse' },
      });
      expect(
        scenario.transaction.applicationSessionCredential.createMany,
      ).not.toHaveBeenCalled();
      expect(scenario.recordEvent).toHaveBeenCalledWith(
        'dashboard_refresh_reuse_revoked',
      );
    }
  });
});
