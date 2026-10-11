import { describe, expect, it, vi } from 'vitest';
import {
  createSitesFeature,
  SitesConflictError,
  SitesForbiddenError,
  SitesNotFoundError,
  SitesPaidSeatRequiredError,
  SitesUpgradeRequiredError,
} from './sites.js';

const siteId = '7fced42f-e2e4-4c31-89db-f282bdaeea44';
const siteSummary = {
  id: siteId,
  name: 'Main site',
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-09-01T11:00:00.000Z',
  memberCount: 1,
  memberPreview: [{ displayName: 'Owner Example', initials: 'OE' }],
};
const principal = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  membershipId: 'membership-1',
  roleId: 'owner',
  email: 'owner@example.com',
};
const request = {
  name: 'Main site',
  accessScope: 'ORGANIZATION' as const,
  organizationAccess: 'VIEW_COMMENT' as const,
  idempotencyKey: 'a'.repeat(32),
};

function harness(overrides: Record<string, unknown> = {}) {
  const dependencies = {
    findCreationRequest: vi.fn().mockResolvedValue(null),
    loadContext: vi.fn().mockResolvedValue({
      organizationName: 'Hansel',
      planId: 'plus',
      maximumSites: null,
      members: [
        {
          email: 'owner@example.com',
          displayName: 'Owner Example',
          initials: 'OE',
        },
        { email: 'editor@example.com', displayName: 'Ed Itor', initials: 'EI' },
      ],
      sites: [],
    }),
    persist: vi.fn().mockResolvedValue({ status: 'created', siteId }),
    loadActivity: vi.fn().mockResolvedValue(siteSummary),
    createId: vi.fn().mockReturnValue('invitation-id'),
    createInvitationToken: vi
      .fn()
      .mockReturnValue({ token: 'secret', tokenDigest: 'digest' }),
    digestRequest: vi.fn().mockReturnValue('request-digest'),
    now: () => new Date('2026-09-01T12:00:00Z'),
    ...overrides,
  };
  return { dependencies, feature: createSitesFeature(dependencies) };
}

describe('Sites feature [sites-add-new REQ-007..REQ-016]', () => {
  it('creates a Private site without Organization access or invite assignments [sites-access-scope REQ-010, REQ-015..REQ-018]', async () => {
    const h = harness();
    const privateRequest = {
      name: 'Private site',
      accessScope: 'PRIVATE' as const,
      idempotencyKey: 'p'.repeat(32),
    };

    await expect(h.feature.create(principal, privateRequest)).resolves.toEqual({
      siteId,
      destination: `/sites/${siteId}/activity`,
    });
    expect(h.dependencies.persist).toHaveBeenCalledWith({
      principal,
      request: privateRequest,
      requestDigest: 'request-digest',
      internalAssignments: [],
      externalInvitations: [],
    });
  });

  it.each(['editor', 'viewer', 'unknown'])(
    'forbids the %s role from creating sites',
    async (roleId) => {
      const { feature, dependencies } = harness();
      await expect(
        feature.create({ ...principal, roleId }, request),
      ).rejects.toEqual(new SitesForbiddenError());
      expect(dependencies.persist).not.toHaveBeenCalled();
    },
  );

  it('loads bounded creation context for authorized and read-only roles', async () => {
    const owner = harness();
    await expect(owner.feature.load(principal)).resolves.toMatchObject({
      organizationName: 'Hansel',
      canCreateSite: true,
      canInviteMembers: true,
      creator: {
        email: 'owner@example.com',
        displayName: 'Owner Example',
        initials: 'OE',
      },
      siteLimitReached: false,
      maximumSites: null,
      members: [
        { email: 'editor@example.com', displayName: 'Ed Itor', initials: 'EI' },
      ],
    });
    const freeEditor = harness({
      loadContext: vi.fn().mockResolvedValue({
        organizationName: 'Hansel',
        planId: 'free',
        maximumSites: 1,
        members: [
          {
            email: 'owner@example.com',
            displayName: 'Owner Example',
            initials: 'OE',
          },
        ],
        sites: [{ ...siteSummary, name: 'Existing' }],
      }),
    });
    await expect(
      freeEditor.feature.load({ ...principal, roleId: 'editor' }),
    ).resolves.toEqual({
      organizationName: 'Hansel',
      canCreateSite: false,
      canInviteMembers: false,
      creator: {
        email: 'owner@example.com',
        displayName: 'Owner Example',
        initials: 'OE',
      },
      siteLimitReached: true,
      maximumSites: 1,
      ownedSiteCount: 1,
      sharedSiteCount: 0,
      members: [],
      sites: [{ ...siteSummary, name: 'Existing' }],
    });
  });

  it('returns only owned or shared sites for the requested view', async () => {
    const h = harness({
      loadContext: vi.fn().mockResolvedValue({
        organizationName: 'Hansel',
        planId: 'plus',
        maximumSites: null,
        members: [
          {
            email: 'owner@example.com',
            displayName: 'Owner Example',
            initials: 'OE',
          },
        ],
        sites: [
          { ...siteSummary, isOwnedByCurrentMembership: true },
          {
            ...siteSummary,
            id: 'shared-site',
            name: 'Shared site',
            isOwnedByCurrentMembership: false,
          },
        ],
      }),
    });

    await expect(h.feature.load(principal, 'owned')).resolves.toMatchObject({
      sites: [{ id: siteId }],
    });
    await expect(h.feature.load(principal, 'shared')).resolves.toMatchObject({
      sites: [{ id: 'shared-site' }],
    });
  });

  it('fails closed when the authenticated tenant member is absent from context', async () => {
    const h = harness({
      loadContext: vi.fn().mockResolvedValue({
        organizationName: 'Hansel',
        planId: 'plus',
        maximumSites: null,
        members: [],
        sites: [],
      }),
    });
    await expect(h.feature.load(principal)).rejects.toThrow(
      'tenant_creator_missing',
    );
  });

  it('normalizes duplicate staging, classifies tenant members, and creates seven-day Viewer invitations', async () => {
    const h = harness();
    const input = {
      name: request.name,
      accessScope: 'PEOPLE_INVITED' as const,
      assignments: [
        { email: 'editor@example.com', role: 'EDITOR' as const },
        { email: 'guest@example.com', role: 'ADMINISTRATOR' as const },
        { email: 'guest@example.com', role: 'VIEWER' as const },
      ],
      idempotencyKey: request.idempotencyKey,
    };
    await expect(h.feature.create(principal, input)).resolves.toEqual({
      siteId,
      destination: `/sites/${siteId}/activity`,
    });
    expect(h.dependencies.persist).toHaveBeenCalledWith({
      principal,
      request: {
        name: request.name,
        accessScope: 'PEOPLE_INVITED',
        assignments: [
          { email: 'editor@example.com', role: 'EDITOR' },
          { email: 'guest@example.com', role: 'VIEWER' },
        ],
        idempotencyKey: request.idempotencyKey,
      },
      requestDigest: 'request-digest',
      internalAssignments: [{ email: 'editor@example.com', role: 'EDITOR' }],
      externalInvitations: [
        {
          email: 'guest@example.com',
          role: 'VIEWER',
          invitationId: 'invitation-id',
          token: 'secret',
          tokenDigest: 'digest',
          expiresAt: new Date('2026-09-08T12:00:00Z'),
        },
      ],
    });
  });

  it('blocks free invitations and unapproved external paid-seat roles', async () => {
    const free = harness({
      loadContext: vi.fn().mockResolvedValue({
        organizationName: 'Hansel',
        planId: 'free',
        maximumSites: 1,
        members: [],
        sites: [],
      }),
    });
    await expect(
      free.feature.create(principal, {
        name: request.name,
        accessScope: 'PEOPLE_INVITED',
        assignments: [{ email: 'guest@example.com', role: 'VIEWER' }],
        idempotencyKey: request.idempotencyKey,
      }),
    ).rejects.toBeInstanceOf(SitesUpgradeRequiredError);
    const paid = harness();
    await expect(
      paid.feature.create(principal, {
        name: request.name,
        accessScope: 'PEOPLE_INVITED',
        assignments: [{ email: 'guest@example.com', role: 'EDITOR' }],
        idempotencyKey: request.idempotencyKey,
      }),
    ).rejects.toBeInstanceOf(SitesPaidSeatRequiredError);
  });

  it.each([
    ['forbidden', SitesForbiddenError],
    ['site_limit', SitesUpgradeRequiredError],
    ['conflict', SitesConflictError],
  ] as const)(
    'maps persistence %s to its domain boundary',
    async (status, ErrorType) => {
      const h = harness({ persist: vi.fn().mockResolvedValue({ status }) });
      await expect(h.feature.create(principal, request)).rejects.toBeInstanceOf(
        ErrorType,
      );
    },
  );

  it('accepts an idempotent replay before loading mutable plan state', async () => {
    const h = harness({
      findCreationRequest: vi
        .fn()
        .mockResolvedValue({ status: 'replayed', siteId }),
      loadContext: vi.fn().mockRejectedValue(new Error('plan downgraded')),
    });
    await expect(h.feature.create(principal, request)).resolves.toEqual({
      siteId,
      destination: `/sites/${siteId}/activity`,
    });
    expect(h.dependencies.loadContext).not.toHaveBeenCalled();
    expect(h.dependencies.persist).not.toHaveBeenCalled();
  });

  it('rejects a changed idempotent request before loading context', async () => {
    const h = harness({
      findCreationRequest: vi.fn().mockResolvedValue({ status: 'conflict' }),
    });
    await expect(h.feature.create(principal, request)).rejects.toBeInstanceOf(
      SitesConflictError,
    );
    expect(h.dependencies.loadContext).not.toHaveBeenCalled();
  });

  it('supports the default clock when no invitation timestamp is required', async () => {
    const h = harness({ now: undefined });
    await expect(h.feature.create(principal, request)).resolves.toEqual({
      siteId,
      destination: `/sites/${siteId}/activity`,
    });
  });

  it('loads Activity tenant-safely and hides an unavailable site', async () => {
    const found = harness();
    await expect(found.feature.activity(principal, siteId)).resolves.toEqual({
      site: siteSummary,
    });
    const absent = harness({ loadActivity: vi.fn().mockResolvedValue(null) });
    await expect(
      absent.feature.activity(principal, siteId),
    ).rejects.toBeInstanceOf(SitesNotFoundError);
  });
});
