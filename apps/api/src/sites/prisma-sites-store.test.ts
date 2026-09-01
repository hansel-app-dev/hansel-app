import { describe, expect, it, vi } from 'vitest';
import { createPrismaSitesStore } from './prisma-sites-store.js';
import type { SitesPersistInput } from './sites.js';

const now = new Date('2026-09-01T12:00:00Z');
const principal = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  membershipId: 'membership-1',
  roleId: 'owner',
  email: 'owner@example.com',
};
const siteId = '7fced42f-e2e4-4c31-89db-f282bdaeea44';

function harness() {
  const credential = {
    kind: 'ACCESS',
    expiresAt: new Date('2026-09-01T12:15:00Z'),
    consumedAt: null,
    family: {
      userId: 'user-1',
      tenantId: 'tenant-1',
      absoluteExpiresAt: new Date('2026-10-01T12:00:00Z'),
      revokedAt: null,
      user: { email: 'owner@example.com' },
    },
  };
  const transaction = {
    siteCreationRequest: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
    membership: {
      findUnique: vi.fn().mockResolvedValue({
        userId: 'user-1',
        tenantId: 'tenant-1',
        roleId: 'owner',
      }),
      findFirst: vi.fn().mockResolvedValue({
        user: { planSelection: { planId: 'plus', maximumSites: null } },
      }),
      findMany: vi.fn().mockResolvedValue([
        { id: 'membership-1', user: { email: 'owner@example.com' } },
        { id: 'membership-2', user: { email: 'editor@example.com' } },
      ]),
    },
    site: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({}),
    },
    siteGrant: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
    siteInvitation: { create: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    siteCreationRequest: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    applicationSessionCredential: {
      findUnique: vi.fn().mockResolvedValue(credential),
    },
    membership: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: 'membership-1', roleId: 'owner' }),
    },
    tenant: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        name: 'Hansel',
        memberships: [
          {
            roleId: 'owner',
            user: {
              email: 'owner@example.com',
              personalProfile: { firstName: 'Nabin', lastName: 'Singh' },
              planSelection: { planId: 'plus', maximumSites: null },
            },
          },
          {
            roleId: 'editor',
            user: {
              email: 'missing@example.com',
              personalProfile: null,
              planSelection: null,
            },
          },
        ],
        sites: [{ id: siteId, name: 'Existing' }],
      }),
    },
    site: {
      findFirst: vi.fn().mockResolvedValue({ id: siteId, name: 'Existing' }),
    },
    $transaction: vi.fn(
      (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
  };
  const digest = vi.fn().mockReturnValue('key-digest');
  return {
    credential,
    transaction,
    prisma,
    digest,
    store: createPrismaSitesStore(prisma as never, digest, () => siteId),
  };
}

function persistInput(
  overrides: Partial<SitesPersistInput> = {},
): SitesPersistInput {
  return {
    principal,
    request: {
      name: 'Main site',
      organizationAccess: 'VIEW_COMMENT',
      assignments: [
        { email: 'owner@example.com', role: 'ADMINISTRATOR' },
        { email: 'editor@example.com', role: 'EDITOR' },
        { email: 'guest@example.com', role: 'VIEWER' },
      ],
      idempotencyKey: 'a'.repeat(32),
    },
    requestDigest: 'request-digest',
    internalAssignments: [
      { email: 'owner@example.com', role: 'ADMINISTRATOR' },
      { email: 'editor@example.com', role: 'EDITOR' },
    ],
    externalInvitations: [
      {
        email: 'guest@example.com',
        role: 'VIEWER',
        invitationId: '8cc4de54-d707-4fad-9c0f-d9ea4705822c',
        token: 'private-token',
        tokenDigest: 'token-digest',
        expiresAt: new Date('2026-09-08T12:00:00Z'),
      },
    ],
    ...overrides,
  };
}

describe('Prisma sites store [sites-add-new REQ-010..REQ-016, REQ-019]', () => {
  it('resolves only a live access credential with a current tenant membership', async () => {
    const h = harness();
    await expect(h.store.resolvePrincipal('digest', now)).resolves.toEqual(
      principal,
    );
    expect(h.prisma.membership.findUnique).toHaveBeenCalledWith({
      where: { userId_tenantId: { userId: 'user-1', tenantId: 'tenant-1' } },
      select: { id: true, roleId: true },
    });
  });

  it.each([
    null,
    { kind: 'REFRESH' },
    { consumedAt: now },
    { expiresAt: now },
    { family: { revokedAt: now } },
    { family: { absoluteExpiresAt: now } },
  ])('rejects an unavailable credential state %#', async (change) => {
    const h = harness();
    if (change === null)
      h.prisma.applicationSessionCredential.findUnique.mockResolvedValue(null);
    else if ('family' in change)
      h.prisma.applicationSessionCredential.findUnique.mockResolvedValue({
        ...h.credential,
        family: { ...h.credential.family, ...change.family },
      });
    else
      h.prisma.applicationSessionCredential.findUnique.mockResolvedValue({
        ...h.credential,
        ...change,
      });
    await expect(h.store.resolvePrincipal('digest', now)).resolves.toBeNull();
    expect(h.prisma.membership.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a live credential after membership removal', async () => {
    const h = harness();
    h.prisma.membership.findUnique.mockResolvedValue(null);
    await expect(h.store.resolvePrincipal('digest', now)).resolves.toBeNull();
  });

  it('loads the tenant plan, all member choices, and only tenant sites', async () => {
    const h = harness();
    await expect(h.store.loadContext(principal)).resolves.toEqual({
      organizationName: 'Hansel',
      planId: 'plus',
      maximumSites: null,
      members: [
        {
          email: 'owner@example.com',
          displayName: 'Nabin Singh',
          initials: 'NS',
        },
        {
          email: 'missing@example.com',
          displayName: 'missing',
          initials: 'MI',
        },
      ],
      sites: [{ id: siteId, name: 'Existing' }],
    });
  });

  it.each([
    [null, null],
    [
      { requestDigest: 'request-digest', siteId },
      { status: 'replayed', siteId },
    ],
    [{ requestDigest: 'changed-digest', siteId }, { status: 'conflict' }],
  ])('finds a tenant-scoped creation request %#', async (record, result) => {
    const h = harness();
    h.prisma.siteCreationRequest.findUnique.mockResolvedValue(record);
    await expect(
      h.store.findCreationRequest(principal, 'a'.repeat(32), 'request-digest'),
    ).resolves.toEqual(result);
    expect(h.prisma.siteCreationRequest.findUnique).toHaveBeenCalledWith({
      where: {
        tenantId_keyDigest: {
          tenantId: 'tenant-1',
          keyDigest: 'key-digest',
        },
      },
      select: { requestDigest: true, siteId: true },
    });
  });

  it('handles one-part initials and rejects tenants without an Owner plan', async () => {
    const initials = harness();
    initials.prisma.tenant.findUniqueOrThrow.mockResolvedValue({
      name: 'Hansel',
      memberships: [
        {
          roleId: 'owner',
          user: {
            email: 'owner@example.com',
            personalProfile: { firstName: '', lastName: '' },
            planSelection: { planId: 'free', maximumSites: 1 },
          },
        },
      ],
      sites: [],
    });
    await expect(initials.store.loadContext(principal)).resolves.toMatchObject({
      members: [{ initials: '' }],
    });
    for (const memberships of [
      [],
      [{ roleId: 'owner', user: { planSelection: null } }],
    ]) {
      const missing = harness();
      missing.prisma.tenant.findUniqueOrThrow.mockResolvedValue({
        name: 'Hansel',
        memberships,
        sites: [],
      });
      await expect(missing.store.loadContext(principal)).rejects.toThrow(
        'tenant_plan_selection_missing',
      );
    }
  });

  it('creates a site, creator/internal grants, invitation intent, and idempotency record in one transaction', async () => {
    const h = harness();
    await expect(h.store.persist(persistInput())).resolves.toEqual({
      status: 'created',
      siteId,
    });
    expect(h.digest).toHaveBeenCalledWith(`site-idempotency:${'a'.repeat(32)}`);
    expect(h.transaction.siteGrant.createMany).toHaveBeenCalledWith({
      data: [
        {
          siteId,
          membershipId: 'membership-2',
          tenantId: 'tenant-1',
          role: 'EDITOR',
        },
        {
          siteId,
          membershipId: 'membership-1',
          tenantId: 'tenant-1',
          role: 'ADMINISTRATOR',
        },
      ],
    });
    expect(h.transaction.siteInvitation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: '8cc4de54-d707-4fad-9c0f-d9ea4705822c',
        tenantId: 'tenant-1',
        tokenDigest: 'token-digest',
        delivery: { create: { nextAttemptAt: now } },
      }),
    });
    expect(h.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
  });

  it.each([
    ['request-digest', { status: 'replayed', siteId }],
    ['changed-digest', { status: 'conflict' }],
  ])(
    'handles an existing idempotency record with digest %s',
    async (requestDigest, result) => {
      const h = harness();
      h.transaction.siteCreationRequest.findUnique.mockResolvedValue({
        requestDigest,
        siteId,
      });
      await expect(h.store.persist(persistInput())).resolves.toEqual(result);
      expect(h.transaction.site.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    null,
    { userId: 'other', tenantId: 'tenant-1', roleId: 'owner' },
    { userId: 'user-1', tenantId: 'other', roleId: 'owner' },
    { userId: 'user-1', tenantId: 'tenant-1', roleId: 'editor' },
  ])(
    'rechecks organization authorization inside the transaction %#',
    async (membership) => {
      const h = harness();
      h.transaction.membership.findUnique.mockResolvedValue(membership);
      await expect(h.store.persist(persistInput())).resolves.toEqual({
        status: 'forbidden',
      });
    },
  );

  it('rejects a missing Owner plan, the site ceiling, and Free invitations', async () => {
    for (const owner of [null, { user: { planSelection: null } }]) {
      const h = harness();
      h.transaction.membership.findFirst.mockResolvedValue(owner);
      await expect(h.store.persist(persistInput())).rejects.toThrow(
        'tenant_plan_selection_missing',
      );
    }
    const limited = harness();
    limited.transaction.membership.findFirst.mockResolvedValue({
      user: { planSelection: { planId: 'free', maximumSites: 1 } },
    });
    limited.transaction.site.count.mockResolvedValue(1);
    await expect(
      limited.store.persist(persistInput({ externalInvitations: [] })),
    ).resolves.toEqual({ status: 'site_limit' });
    const freeInvite = harness();
    freeInvite.transaction.membership.findFirst.mockResolvedValue({
      user: { planSelection: { planId: 'free', maximumSites: 2 } },
    });
    await expect(freeInvite.store.persist(persistInput())).resolves.toEqual({
      status: 'site_limit',
    });
  });

  it('supports no internal lookup and rejects a manipulated cross-tenant member', async () => {
    const none = harness();
    await expect(
      none.store.persist(
        persistInput({ internalAssignments: [], externalInvitations: [] }),
      ),
    ).resolves.toEqual({ status: 'created', siteId });
    expect(none.transaction.membership.findMany).not.toHaveBeenCalled();
    const missing = harness();
    missing.transaction.membership.findMany.mockResolvedValue([]);
    await expect(
      missing.store.persist(persistInput({ externalInvitations: [] })),
    ).resolves.toEqual({ status: 'forbidden' });
  });

  it('uses a generated site id by default and loads Activity only through tenant scope', async () => {
    const h = harness();
    const defaultStore = createPrismaSitesStore(h.prisma as never, h.digest);
    const result = await defaultStore.persist(
      persistInput({ internalAssignments: [], externalInvitations: [] }),
    );
    expect(result).toMatchObject({
      status: 'created',
      siteId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    await expect(h.store.loadActivity(principal, siteId)).resolves.toEqual({
      id: siteId,
      name: 'Existing',
    });
    expect(h.prisma.site.findFirst).toHaveBeenCalledWith({
      where: { id: siteId, tenantId: 'tenant-1' },
      select: { id: true, name: true },
    });
  });
});
