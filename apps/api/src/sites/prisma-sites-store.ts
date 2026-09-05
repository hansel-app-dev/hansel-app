/** @spec sites-add-new REQ-010..REQ-016, REQ-019 @spec sites-populated-state REQ-002..REQ-004, REQ-012, REQ-019, REQ-024 */
import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { SiteSummary } from '@hansel/contracts';
import type { ApplicationPrincipal, SitesPersistInput } from './sites.js';

function initials(firstName: string, lastName: string): string {
  return `${Array.from(firstName)[0] ?? ''}${Array.from(lastName)[0] ?? ''}`.toLocaleUpperCase();
}

const siteSummarySelect = {
  id: true,
  name: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { grants: true } },
  grants: {
    where: {
      membership: { user: { personalProfile: { isNot: null } } },
    },
    orderBy: [{ createdAt: 'asc' }, { membershipId: 'asc' }],
    take: 3,
    select: {
      membership: {
        select: {
          user: {
            select: {
              personalProfile: {
                select: { firstName: true, lastName: true },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.SiteSelect;

type SiteSummaryRecord = Prisma.SiteGetPayload<{
  select: typeof siteSummarySelect;
}>;

function displayIdentity(user: {
  email: string;
  personalProfile: { firstName: string; lastName: string } | null;
}) {
  const displayName = user.personalProfile
    ? `${user.personalProfile.firstName} ${user.personalProfile.lastName}`
    : user.email.slice(0, user.email.indexOf('@'));
  return {
    displayName,
    initials: user.personalProfile
      ? initials(user.personalProfile.firstName, user.personalProfile.lastName)
      : Array.from(displayName).slice(0, 2).join('').toLocaleUpperCase(),
  };
}

function profileIdentity(
  profile: { firstName: string; lastName: string } | null,
) {
  if (!profile)
    throw new Error('Site member preview requires a personal profile.');
  return {
    displayName: `${profile.firstName} ${profile.lastName}`,
    initials: initials(profile.firstName, profile.lastName),
  };
}

function toSiteSummary(site: SiteSummaryRecord): SiteSummary {
  return {
    id: site.id,
    name: site.name,
    createdAt: site.createdAt.toISOString(),
    updatedAt: site.updatedAt.toISOString(),
    memberCount: site._count.grants,
    memberPreview: site.grants.map(({ membership }) =>
      profileIdentity(membership.user.personalProfile),
    ),
  };
}

function siteAccessWhere(
  principal: ApplicationPrincipal,
): Prisma.SiteWhereInput | undefined {
  if (principal.roleId === 'owner') return undefined;
  return {
    OR: [
      { accessScope: 'ORGANIZATION' },
      { createdByMembershipId: principal.membershipId },
      {
        accessScope: 'PEOPLE_INVITED',
        grants: { some: { membershipId: principal.membershipId } },
      },
    ],
  };
}

export function createPrismaSitesStore(
  prisma: PrismaClient,
  digest: (value: string) => string,
  createSiteId: () => string = randomUUID,
) {
  return {
    async findCreationRequest(
      principal: ApplicationPrincipal,
      idempotencyKey: string,
      requestDigest: string,
    ) {
      const previous = await prisma.siteCreationRequest.findUnique({
        where: {
          tenantId_keyDigest: {
            tenantId: principal.tenantId,
            keyDigest: digest(`site-idempotency:${idempotencyKey}`),
          },
        },
        select: { requestDigest: true, siteId: true },
      });
      if (!previous) return null;
      return previous.requestDigest === requestDigest
        ? ({ status: 'replayed', siteId: previous.siteId } as const)
        : ({ status: 'conflict' } as const);
    },

    async resolvePrincipal(
      credentialDigest: string,
      now: Date,
    ): Promise<ApplicationPrincipal | null> {
      const credential = await prisma.applicationSessionCredential.findUnique({
        where: { credentialDigest },
        select: {
          kind: true,
          expiresAt: true,
          consumedAt: true,
          family: {
            select: {
              userId: true,
              tenantId: true,
              absoluteExpiresAt: true,
              revokedAt: true,
              user: { select: { email: true } },
            },
          },
        },
      });
      if (
        credential?.kind !== 'ACCESS' ||
        credential.consumedAt ||
        credential.expiresAt <= now ||
        credential.family.revokedAt ||
        credential.family.absoluteExpiresAt <= now
      )
        return null;
      const membership = await prisma.membership.findUnique({
        where: {
          userId_tenantId: {
            userId: credential.family.userId,
            tenantId: credential.family.tenantId,
          },
        },
        select: { id: true, roleId: true },
      });
      if (!membership) return null;
      return {
        userId: credential.family.userId,
        tenantId: credential.family.tenantId,
        membershipId: membership.id,
        roleId: membership.roleId,
        email: credential.family.user.email,
      };
    },

    async loadContext(principal: ApplicationPrincipal) {
      const accessWhere = siteAccessWhere(principal);
      const tenant = await prisma.tenant.findUniqueOrThrow({
        where: { id: principal.tenantId },
        select: {
          name: true,
          memberships: {
            orderBy: { createdAt: 'asc' },
            select: {
              roleId: true,
              user: {
                select: {
                  email: true,
                  personalProfile: {
                    select: { firstName: true, lastName: true },
                  },
                  planSelection: {
                    select: { planId: true, maximumSites: true },
                  },
                },
              },
            },
          },
          sites: {
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            ...(accessWhere ? { where: accessWhere } : {}),
            select: siteSummarySelect,
          },
        },
      });
      const owner = tenant.memberships.find(({ roleId }) => roleId === 'owner');
      if (!owner?.user.planSelection)
        throw new Error('tenant_plan_selection_missing');
      return {
        organizationName: tenant.name,
        planId: owner.user.planSelection.planId,
        maximumSites: owner.user.planSelection.maximumSites,
        members: tenant.memberships.map(({ user }) => ({
          email: user.email,
          ...displayIdentity(user),
        })),
        sites: tenant.sites.map(toSiteSummary),
      };
    },

    async persist(input: SitesPersistInput) {
      const keyDigest = digest(
        `site-idempotency:${input.request.idempotencyKey}`,
      );
      return prisma.$transaction(
        async (transaction) => {
          const previous = await transaction.siteCreationRequest.findUnique({
            where: {
              tenantId_keyDigest: {
                tenantId: input.principal.tenantId,
                keyDigest,
              },
            },
            select: { requestDigest: true, siteId: true },
          });
          if (previous)
            return previous.requestDigest === input.requestDigest
              ? ({ status: 'replayed', siteId: previous.siteId } as const)
              : ({ status: 'conflict' } as const);

          const membership = await transaction.membership.findUnique({
            where: { id: input.principal.membershipId },
            select: { userId: true, tenantId: true, roleId: true },
          });
          if (
            membership?.userId !== input.principal.userId ||
            membership.tenantId !== input.principal.tenantId ||
            !['owner', 'administrator', 'admin'].includes(membership.roleId)
          )
            return { status: 'forbidden' } as const;

          const owner = await transaction.membership.findFirst({
            where: { tenantId: input.principal.tenantId, roleId: 'owner' },
            select: {
              user: {
                select: {
                  planSelection: {
                    select: { planId: true, maximumSites: true },
                  },
                },
              },
            },
          });
          if (!owner?.user.planSelection)
            throw new Error('tenant_plan_selection_missing');
          const siteCount = await transaction.site.count({
            where: { tenantId: input.principal.tenantId },
          });
          if (
            owner.user.planSelection.maximumSites !== null &&
            siteCount >= owner.user.planSelection.maximumSites
          )
            return { status: 'site_limit' } as const;
          if (
            owner.user.planSelection.planId === 'free' &&
            input.request.accessScope === 'PEOPLE_INVITED'
          )
            return { status: 'site_limit' } as const;

          const internalEmails = input.internalAssignments.map(
            ({ email }: { email: string }) => email,
          );
          const internalMemberships =
            internalEmails.length === 0
              ? []
              : await transaction.membership.findMany({
                  where: {
                    tenantId: input.principal.tenantId,
                    user: { email: { in: internalEmails } },
                  },
                  select: { id: true, user: { select: { email: true } } },
                });
          if (internalMemberships.length !== new Set(internalEmails).size)
            return { status: 'forbidden' } as const;

          const siteId = createSiteId();
          await transaction.site.create({
            data: {
              id: siteId,
              tenantId: input.principal.tenantId,
              createdByMembershipId: input.principal.membershipId,
              name: input.request.name,
              accessScope: input.request.accessScope,
              organizationAccess:
                input.request.accessScope === 'ORGANIZATION'
                  ? input.request.organizationAccess
                  : null,
            },
          });
          const rolesByEmail = new Map(
            input.internalAssignments.map(
              ({ email, role }: { email: string; role: string }) => [
                email,
                role,
              ],
            ),
          );
          await transaction.siteGrant.createMany({
            data: [
              ...internalMemberships
                .filter(({ id }) => id !== input.principal.membershipId)
                .map(({ id, user }) => ({
                  siteId,
                  membershipId: id,
                  tenantId: input.principal.tenantId,
                  role: rolesByEmail.get(user.email) as
                    'ADMINISTRATOR' | 'EDITOR' | 'VIEWER',
                })),
              {
                siteId,
                membershipId: input.principal.membershipId,
                tenantId: input.principal.tenantId,
                role: 'ADMINISTRATOR' as const,
              },
            ],
          });
          for (const invitation of input.externalInvitations) {
            await transaction.siteInvitation.create({
              data: {
                id: invitation.invitationId,
                siteId,
                tenantId: input.principal.tenantId,
                email: invitation.email,
                role: invitation.role,
                tokenDigest: invitation.tokenDigest,
                expiresAt: invitation.expiresAt,
                delivery: {
                  create: {
                    nextAttemptAt: new Date(
                      invitation.expiresAt.getTime() - 7 * 24 * 60 * 60 * 1_000,
                    ),
                  },
                },
              },
            });
          }
          await transaction.siteCreationRequest.create({
            data: {
              tenantId: input.principal.tenantId,
              keyDigest,
              requestDigest: input.requestDigest,
              siteId,
            },
          });
          return { status: 'created', siteId } as const;
        },
        { isolationLevel: 'Serializable' },
      );
    },

    async loadActivity(principal: ApplicationPrincipal, siteId: string) {
      const accessWhere = siteAccessWhere(principal);
      return prisma.site.findFirst({
        where: {
          id: siteId,
          tenantId: principal.tenantId,
          ...(accessWhere ?? {}),
        },
        select: { id: true, name: true },
      });
    },
  };
}
