import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { createPrismaDashboardSessionStore } from './prisma-session-store.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = describe.skipIf(!databaseUrl);
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl ?? 'postgresql://unused:unused@127.0.0.1:1/skipped',
    },
  },
});
const now = new Date('2026-08-29T00:00:00.000Z');

async function seedSession() {
  const id = randomUUID();
  const user = await prisma.user.create({
    data: {
      email: `dashboard-${id}@example.com`,
      personalProfile: {
        create: {
          firstName: 'Nabin',
          lastName: 'Singh',
          jobTitle: 'manager',
          department: 'marketing_communications',
        },
      },
    },
  });
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Hansel',
      country: 'AU',
      industry: 'healthcare',
      placeService: 'clinics',
      organizationSize: 'employees_11_50',
      memberships: { create: { userId: user.id, roleId: 'owner' } },
    },
  });
  const accessDigest = `access-${id}`;
  const refreshDigest = `refresh-${id}`;
  const family = await prisma.applicationSessionFamily.create({
    data: {
      userId: user.id,
      tenantId: tenant.id,
      absoluteExpiresAt: new Date('2026-09-28T00:00:00.000Z'),
      credentials: {
        create: [
          {
            kind: 'ACCESS',
            credentialDigest: accessDigest,
            expiresAt: new Date('2026-08-29T00:15:00.000Z'),
          },
          {
            kind: 'REFRESH',
            credentialDigest: refreshDigest,
            expiresAt: new Date('2026-09-28T00:00:00.000Z'),
          },
        ],
      },
    },
  });
  return { user, tenant, family, accessDigest, refreshDigest };
}

integration(
  'PostgreSQL dashboard sessions [dashboard-home REQ-007, REQ-010, REQ-011, REQ-018]',
  () => {
    afterAll(() => prisma.$disconnect());

    it('revokes represented session families without changing unrelated families [dashboard-logout REQ-005, REQ-007]', async () => {
      const current = await seedSession();
      const unrelated = await seedSession();
      const store = createPrismaDashboardSessionStore(prisma, () => undefined);

      await store.revokeFamilies({
        credentialDigests: [current.accessDigest, current.refreshDigest],
        now,
      });
      await expect(
        prisma.applicationSessionFamily.findUniqueOrThrow({
          where: { id: current.family.id },
        }),
      ).resolves.toMatchObject({
        revokedAt: now,
        revocationReason: 'user_logout',
      });
      await expect(
        prisma.applicationSessionFamily.findUniqueOrThrow({
          where: { id: unrelated.family.id },
        }),
      ).resolves.toMatchObject({ revokedAt: null, revocationReason: null });

      await expect(
        store.revokeFamilies({
          credentialDigests: [current.accessDigest, 'unknown'],
          now: new Date('2026-08-30T00:00:00.000Z'),
        }),
      ).resolves.toBeUndefined();
      await expect(
        prisma.applicationSessionFamily.findUniqueOrThrow({
          where: { id: current.family.id },
        }),
      ).resolves.toMatchObject({ revokedAt: now });
    });

    it('uses current tenant membership and rejects expiry or membership removal', async () => {
      const seeded = await seedSession();
      const store = createPrismaDashboardSessionStore(prisma, () => undefined);
      await expect(
        store.authorizeAccess({ credentialDigest: seeded.accessDigest, now }),
      ).resolves.toEqual({
        firstName: 'Nabin',
        lastName: 'Singh',
        roleId: 'owner',
      });

      await prisma.membership.delete({
        where: {
          userId_tenantId: {
            userId: seeded.user.id,
            tenantId: seeded.tenant.id,
          },
        },
      });
      const otherTenant = await prisma.tenant.create({
        data: {
          name: 'Other',
          country: 'AU',
          industry: 'healthcare',
          placeService: 'clinics',
          organizationSize: 'employees_1_10',
          memberships: {
            create: { userId: seeded.user.id, roleId: 'admin' },
          },
        },
      });
      await expect(
        store.authorizeAccess({ credentialDigest: seeded.accessDigest, now }),
      ).resolves.toBeNull();
      await prisma.membership.deleteMany({
        where: { tenantId: otherTenant.id },
      });
      await prisma.tenant.delete({ where: { id: otherTenant.id } });

      await expect(
        store.authorizeAccess({
          credentialDigest: seeded.accessDigest,
          now: new Date('2026-08-29T00:15:00.000Z'),
        }),
      ).resolves.toBeNull();
    });

    it('rotates once, caps credentials at absolute expiry, and revokes replay', async () => {
      const seeded = await seedSession();
      const store = createPrismaDashboardSessionStore(prisma, () => undefined);
      const input = {
        credentialDigest: seeded.refreshDigest,
        accessCredentialDigest: `next-access-${randomUUID()}`,
        refreshCredentialDigest: `next-refresh-${randomUUID()}`,
        now,
        accessExpiresAt: new Date('2026-09-29T00:00:00.000Z'),
        refreshExpiresAt: new Date('2026-09-29T00:00:00.000Z'),
      };
      await expect(store.rotateRefresh(input)).resolves.toMatchObject({
        status: 'accepted',
        viewer: { roleId: 'owner' },
      });
      const replacements = await prisma.applicationSessionCredential.findMany({
        where: {
          credentialDigest: {
            in: [input.accessCredentialDigest, input.refreshCredentialDigest],
          },
        },
      });
      expect(replacements).toHaveLength(2);
      expect(
        replacements.every(
          ({ expiresAt }) =>
            expiresAt.getTime() ===
            new Date('2026-09-28T00:00:00.000Z').getTime(),
        ),
      ).toBe(true);

      await expect(store.rotateRefresh(input)).resolves.toEqual({
        status: 'rejected',
      });
      await expect(
        prisma.applicationSessionFamily.findUniqueOrThrow({
          where: { id: seeded.family.id },
        }),
      ).resolves.toMatchObject({
        revokedAt: now,
        revocationReason: 'refresh_reuse',
      });
    });

    it('allows one concurrent refresh winner and revokes the family on the losing reuse', async () => {
      const seeded = await seedSession();
      const store = createPrismaDashboardSessionStore(prisma, () => undefined);
      const rotate = (suffix: string) =>
        store.rotateRefresh({
          credentialDigest: seeded.refreshDigest,
          accessCredentialDigest: `concurrent-access-${suffix}-${randomUUID()}`,
          refreshCredentialDigest: `concurrent-refresh-${suffix}-${randomUUID()}`,
          now,
          accessExpiresAt: new Date('2026-08-29T00:15:00.000Z'),
          refreshExpiresAt: new Date('2026-09-20T00:00:00.000Z'),
        });
      const outcomes = await Promise.all([rotate('a'), rotate('b')]);
      expect(outcomes.map(({ status }) => status).sort()).toEqual([
        'accepted',
        'rejected',
      ]);
      await expect(
        prisma.applicationSessionFamily.findUniqueOrThrow({
          where: { id: seeded.family.id },
        }),
      ).resolves.toMatchObject({ revocationReason: 'refresh_reuse' });
    });
  },
);
