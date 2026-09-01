import { createHash, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
import { createPrismaSitesStore } from './prisma-sites-store.js';
import type { ApplicationPrincipal, SitesPersistInput } from './sites.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = describe.skipIf(!databaseUrl);
const prisma = new PrismaClient({
  datasources: {
    db: {
      url:
        databaseUrl ??
        'postgresql://unused:unused@127.0.0.1:1/skipped?schema=public',
    },
  },
});
const now = new Date('2026-09-01T12:00:00.000Z');
const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');

async function seedTenant(
  planId: 'free' | 'plus' = 'plus',
  maximumSites: number | null = null,
) {
  const id = randomUUID();
  const owner = await prisma.user.create({
    data: {
      email: `site-owner-${id}@example.com`,
      emailVerifiedAt: now,
      personalProfile: {
        create: {
          firstName: 'Nabin',
          lastName: 'Singh',
          jobTitle: 'owner',
          department: 'operations',
        },
      },
      planSelection: {
        create: {
          planId,
          priceId: planId === 'free' ? 'free' : 'plus_annual',
          billingInterval: planId === 'free' ? null : 'ANNUAL',
          amountMinor: planId === 'free' ? 0 : 39_000,
          currency: 'USD',
          paymentRequired: planId !== 'free',
          maximumSites,
          catalogVersion: 'sites-integration-v1',
          selectedAt: now,
        },
      },
    },
  });
  const editor = await prisma.user.create({
    data: {
      email: `site-editor-${id}@example.com`,
      emailVerifiedAt: now,
      personalProfile: {
        create: {
          firstName: 'Alex',
          lastName: 'Editor',
          jobTitle: 'editor',
          department: 'operations',
        },
      },
    },
  });
  const tenant = await prisma.tenant.create({
    data: {
      name: `Hansel ${id}`,
      country: 'AU',
      industry: 'healthcare',
      placeService: 'clinics',
      organizationSize: 'employees_11_50',
      memberships: {
        create: [
          { userId: owner.id, roleId: 'owner' },
          { userId: editor.id, roleId: 'editor' },
        ],
      },
    },
  });
  const ownerMembership = await prisma.membership.findUniqueOrThrow({
    where: { userId_tenantId: { userId: owner.id, tenantId: tenant.id } },
  });
  const editorMembership = await prisma.membership.findUniqueOrThrow({
    where: { userId_tenantId: { userId: editor.id, tenantId: tenant.id } },
  });
  const credentialDigest = digest(`access:${id}`);
  await prisma.applicationSessionFamily.create({
    data: {
      userId: owner.id,
      tenantId: tenant.id,
      absoluteExpiresAt: new Date('2026-10-01T12:00:00.000Z'),
      credentials: {
        create: {
          kind: 'ACCESS',
          credentialDigest,
          expiresAt: new Date('2026-09-01T12:15:00.000Z'),
        },
      },
    },
  });
  return {
    owner,
    editor,
    tenant,
    ownerMembership,
    editorMembership,
    credentialDigest,
  };
}

function creationInput(
  principal: ApplicationPrincipal,
  editorEmail: string,
  overrides: Partial<SitesPersistInput> = {},
): SitesPersistInput {
  const idempotencyKey = randomUUID();
  const invitationId = randomUUID();
  return {
    principal,
    request: {
      name: 'Sydney Central',
      organizationAccess: 'VIEW_COMMENT',
      assignments: [
        { email: editorEmail, role: 'EDITOR' },
        { email: 'guest@example.com', role: 'VIEWER' },
      ],
      idempotencyKey,
    },
    requestDigest: digest(`request:${idempotencyKey}`),
    internalAssignments: [{ email: editorEmail, role: 'EDITOR' }],
    externalInvitations: [
      {
        email: 'guest@example.com',
        role: 'VIEWER',
        invitationId,
        token: 'not-persisted',
        tokenDigest: digest(`invitation:${invitationId}`),
        expiresAt: new Date('2026-09-08T12:00:00.000Z'),
      },
    ],
    ...overrides,
  };
}

integration(
  'PostgreSQL site creation [sites-add-new REQ-004, REQ-012..REQ-016, REQ-019]',
  () => {
    afterAll(() => prisma.$disconnect());

    it('atomically persists tenant grants, a durable invitation, and an idempotent result', async () => {
      const seeded = await seedTenant();
      const store = createPrismaSitesStore(prisma, digest);
      const principal = await store.resolvePrincipal(
        seeded.credentialDigest,
        now,
      );
      expect(principal).toMatchObject({
        userId: seeded.owner.id,
        tenantId: seeded.tenant.id,
        membershipId: seeded.ownerMembership.id,
        roleId: 'owner',
      });
      if (!principal) throw new Error('Expected an authenticated principal');
      await expect(store.loadContext(principal)).resolves.toMatchObject({
        planId: 'plus',
        members: expect.arrayContaining([
          expect.objectContaining({ email: seeded.editor.email }),
        ]),
        sites: [],
      });

      const input = creationInput(principal, seeded.editor.email);
      const invitation = input.externalInvitations.at(0);
      if (!invitation) throw new Error('Expected the external invitation');
      const created = await store.persist(input);
      expect(created).toMatchObject({ status: 'created' });
      if (created.status !== 'created') throw new Error('Expected a new site');
      await expect(
        prisma.site.findUniqueOrThrow({
          where: { id: created.siteId },
          include: {
            grants: { orderBy: { membershipId: 'asc' } },
            invitations: { include: { delivery: true } },
            creationRequests: true,
          },
        }),
      ).resolves.toMatchObject({
        tenantId: seeded.tenant.id,
        name: 'Sydney Central',
        grants: expect.arrayContaining([
          expect.objectContaining({
            membershipId: seeded.ownerMembership.id,
            role: 'ADMINISTRATOR',
          }),
          expect.objectContaining({
            membershipId: seeded.editorMembership.id,
            role: 'EDITOR',
          }),
        ]),
        invitations: [
          expect.objectContaining({
            email: 'guest@example.com',
            role: 'VIEWER',
            tokenDigest: invitation.tokenDigest,
            status: 'PENDING',
            delivery: expect.objectContaining({ status: 'PENDING' }),
          }),
        ],
        creationRequests: [
          expect.objectContaining({ requestDigest: input.requestDigest }),
        ],
      });
      expect(
        JSON.stringify(
          await prisma.siteInvitation.findUniqueOrThrow({
            where: { id: invitation.invitationId },
          }),
        ),
      ).not.toContain('not-persisted');

      await expect(store.persist(input)).resolves.toEqual({
        status: 'replayed',
        siteId: created.siteId,
      });
      await expect(
        store.persist({ ...input, requestDigest: digest('changed') }),
      ).resolves.toEqual({ status: 'conflict' });
      await expect(
        prisma.site.count({ where: { tenantId: seeded.tenant.id } }),
      ).resolves.toBe(1);

      const other = await seedTenant();
      await expect(
        store.loadActivity(
          { ...principal, tenantId: other.tenant.id },
          created.siteId,
        ),
      ).resolves.toBeNull();
    });

    it('cannot exceed a one-site plan under concurrent serializable writes', async () => {
      const seeded = await seedTenant('free', 1);
      const store = createPrismaSitesStore(prisma, digest);
      const principal = await store.resolvePrincipal(
        seeded.credentialDigest,
        now,
      );
      if (!principal) throw new Error('Expected an authenticated principal');
      const makeInput = () =>
        creationInput(principal, seeded.editor.email, {
          request: {
            name: `Site ${randomUUID()}`,
            organizationAccess: 'VIEW_COMMENT',
            assignments: [],
            idempotencyKey: randomUUID(),
          },
          requestDigest: digest(randomUUID()),
          internalAssignments: [],
          externalInvitations: [],
        });

      const outcomes = await Promise.allSettled([
        store.persist(makeInput()),
        store.persist(makeInput()),
      ]);
      expect(
        outcomes.filter(
          (outcome) =>
            outcome.status === 'fulfilled' &&
            outcome.value.status === 'created',
        ),
      ).toHaveLength(1);
      await expect(
        prisma.site.count({ where: { tenantId: seeded.tenant.id } }),
      ).resolves.toBe(1);
    });
  },
);
