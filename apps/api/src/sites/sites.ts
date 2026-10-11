/** @spec sites-add-new REQ-007..REQ-016 @spec sites-populated-state REQ-002..REQ-004, REQ-019, REQ-024 */
import type {
  CreateSiteRequest,
  CreateSiteResponse,
  SiteAssignment,
  SiteActivityResponse,
  SiteIdentity,
  SiteMemberChoice,
  SiteSummary,
  SitesPageResponse,
} from '@hansel/contracts';
import { hasOrganizationCapability } from './permissions.js';

export interface ApplicationPrincipal {
  userId: string;
  tenantId: string;
  membershipId: string;
  roleId: string;
  email: string;
}

interface SiteContext {
  organizationName: string;
  planId: string;
  maximumSites: number | null;
  members: SiteMemberChoice[];
  sites: SiteSummary[];
}

export interface SitesPersistInput {
  principal: ApplicationPrincipal;
  request: CreateSiteRequest;
  requestDigest: string;
  internalAssignments: SiteAssignment[];
  externalInvitations: (SiteAssignment & {
    invitationId: string;
    token: string;
    tokenDigest: string;
    expiresAt: Date;
  })[];
}

type PersistResult =
  | { status: 'created' | 'replayed'; siteId: string }
  | { status: 'conflict' }
  | { status: 'site_limit' }
  | { status: 'forbidden' };

interface SitesDependencies {
  findCreationRequest(
    principal: ApplicationPrincipal,
    idempotencyKey: string,
    requestDigest: string,
  ): Promise<
    { status: 'replayed'; siteId: string } | { status: 'conflict' } | null
  >;
  loadContext(principal: ApplicationPrincipal): Promise<SiteContext>;
  persist(input: SitesPersistInput): Promise<PersistResult>;
  loadActivity(
    principal: ApplicationPrincipal,
    siteId: string,
  ): Promise<SiteIdentity | null>;
  createId(): string;
  createInvitationToken(
    invitationId: string,
    expiresAt: Date,
  ): { token: string; tokenDigest: string };
  digestRequest(request: CreateSiteRequest): string;
  now?: () => Date;
}

export type SitesView = 'owned' | 'shared';

export class SitesForbiddenError extends Error {
  readonly code = 'sites_forbidden';
}

export class SitesUpgradeRequiredError extends Error {
  readonly code = 'sites_upgrade_required';
}

export class SitesPaidSeatRequiredError extends Error {
  readonly code = 'sites_paid_seat_required';
}

export class SitesConflictError extends Error {
  readonly code = 'sites_conflict';
}

export class SitesNotFoundError extends Error {
  readonly code = 'sites_not_found';
}

const canCreate = (roleId: string) =>
  hasOrganizationCapability(roleId, 'CREATE_SITE');

export function createSitesFeature(dependencies: SitesDependencies) {
  return {
    async load(
      principal: ApplicationPrincipal,
      view: SitesView = 'owned',
    ): Promise<SitesPageResponse> {
      const context = await dependencies.loadContext(principal);
      const visibleSites = context.sites.filter((site) =>
        view === 'shared'
          ? site.isOwnedByCurrentMembership === false
          : site.isOwnedByCurrentMembership !== false,
      );
      const authorized = canCreate(principal.roleId);
      const creator = context.members.find(
        ({ email }) => email.toLowerCase() === principal.email.toLowerCase(),
      );
      if (!creator) throw new Error('tenant_creator_missing');
      const siteLimitReached =
        context.maximumSites !== null &&
        context.sites.length >= context.maximumSites;
      return {
        organizationName: context.organizationName,
        canCreateSite: authorized,
        canInviteMembers: authorized && context.planId !== 'free',
        creator,
        siteLimitReached,
        maximumSites: context.maximumSites,
        members: authorized
          ? context.members.filter(
              ({ email }) =>
                email.toLowerCase() !== principal.email.toLowerCase(),
            )
          : [],
        sites: visibleSites,
      };
    },

    async create(
      principal: ApplicationPrincipal,
      request: CreateSiteRequest,
    ): Promise<CreateSiteResponse> {
      if (!canCreate(principal.roleId)) throw new SitesForbiddenError();
      const assignments =
        request.accessScope === 'PEOPLE_INVITED'
          ? [
              ...new Map(
                request.assignments.map((assignment) => [
                  assignment.email,
                  assignment,
                ]),
              ).values(),
            ]
          : [];
      const normalizedRequest: CreateSiteRequest =
        request.accessScope === 'PEOPLE_INVITED'
          ? { ...request, assignments }
          : request;
      const requestDigest = dependencies.digestRequest(normalizedRequest);
      const previous = await dependencies.findCreationRequest(
        principal,
        request.idempotencyKey,
        requestDigest,
      );
      if (previous?.status === 'conflict') throw new SitesConflictError();
      if (previous?.status === 'replayed')
        return {
          siteId: previous.siteId,
          destination: `/sites/${previous.siteId}/activity`,
        };
      const context =
        request.accessScope === 'PEOPLE_INVITED'
          ? await dependencies.loadContext(principal)
          : null;
      const memberEmails = new Set(
        context?.members.map(({ email }) => email.toLowerCase()) ?? [],
      );
      const internalAssignments = assignments.filter(({ email }) =>
        memberEmails.has(email),
      );
      const externalAssignments = assignments.filter(
        ({ email }) => !memberEmails.has(email),
      );
      if (
        request.accessScope === 'PEOPLE_INVITED' &&
        context?.planId === 'free'
      )
        throw new SitesUpgradeRequiredError();
      if (externalAssignments.some(({ role }) => role !== 'VIEWER'))
        throw new SitesPaidSeatRequiredError();
      const now = dependencies.now?.() ?? new Date();
      const externalInvitations = externalAssignments.map((assignment) => {
        const invitationId = dependencies.createId();
        const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1_000);
        return {
          ...assignment,
          invitationId,
          ...dependencies.createInvitationToken(invitationId, expiresAt),
          expiresAt,
        };
      });
      const result = await dependencies.persist({
        principal,
        request: normalizedRequest,
        requestDigest,
        internalAssignments,
        externalInvitations,
      });
      if (result.status === 'forbidden') throw new SitesForbiddenError();
      if (result.status === 'site_limit') throw new SitesUpgradeRequiredError();
      if (result.status === 'conflict') throw new SitesConflictError();
      return {
        siteId: result.siteId,
        destination: `/sites/${result.siteId}/activity`,
      };
    },

    async activity(
      principal: ApplicationPrincipal,
      siteId: string,
    ): Promise<SiteActivityResponse> {
      const site = await dependencies.loadActivity(principal, siteId);
      if (!site) throw new SitesNotFoundError();
      return { site };
    },
  };
}
