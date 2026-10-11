/** @spec dashboard-home REQ-007, REQ-010, REQ-011, REQ-018; dashboard-logout REQ-005, REQ-007 */
import type { PrismaClient } from '@prisma/client';

type SiteCounter = { count(input: { where: unknown }): Promise<number> };

async function countAccessibleSites(
  prisma: unknown,
  tenantId: string,
  membershipId: string,
  roleId: string,
) {
  const site = (prisma as { site?: SiteCounter }).site;
  if (!site) return undefined;
  return site.count({
    where:
      roleId === 'owner'
        ? { tenantId }
        : {
            tenantId,
            OR: [
              { accessScope: 'ORGANIZATION' },
              { createdByMembershipId: membershipId },
              {
                accessScope: 'PEOPLE_INVITED',
                grants: { some: { membershipId } },
              },
            ],
          },
  });
}

export function createPrismaDashboardSessionStore(
  prisma: PrismaClient,
  recordEvent: (name: string) => void,
) {
  return {
    async revokeFamilies(input: {
      credentialDigests: string[];
      now: Date;
    }): Promise<void> {
      const credentials = await prisma.applicationSessionCredential.findMany({
        where: { credentialDigest: { in: input.credentialDigests } },
        select: { familyId: true },
      });
      const familyIds = [
        ...new Set(credentials.map(({ familyId }) => familyId)),
      ];
      if (familyIds.length === 0) return;
      await prisma.applicationSessionFamily.updateMany({
        where: { id: { in: familyIds }, revokedAt: null },
        data: { revokedAt: input.now, revocationReason: 'user_logout' },
      });
    },
    async authorizeAccess(input: {
      credentialDigest: string;
      now: Date;
    }): Promise<{
      firstName: string;
      lastName: string;
      roleId: string;
    } | null> {
      const credential = await prisma.applicationSessionCredential.findUnique({
        where: { credentialDigest: input.credentialDigest },
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
              user: {
                select: {
                  email: true,
                  personalProfile: {
                    select: { firstName: true, lastName: true },
                  },
                },
              },
            },
          },
        },
      });
      if (
        credential?.kind !== 'ACCESS' ||
        credential.consumedAt ||
        credential.expiresAt <= input.now ||
        credential.family.revokedAt ||
        credential.family.absoluteExpiresAt <= input.now ||
        !credential.family.user.personalProfile
      )
        return null;
      const membership = await prisma.membership.findUnique({
        where: {
          userId_tenantId: {
            userId: credential.family.userId,
            tenantId: credential.family.tenantId,
          },
        },
        select: {
          id: true,
          roleId: true,
          tenant: {
            select: {
              name: true,
              memberships: {
                where: { roleId: 'owner' },
                take: 1,
                select: {
                  user: {
                    select: { planSelection: { select: { planId: true } } },
                  },
                },
              },
            },
          },
        },
      });
      if (!membership) {
        recordEvent('dashboard_membership_rejected');
        return null;
      }
      const siteCount = await countAccessibleSites(
        prisma,
        credential.family.tenantId,
        membership.id,
        membership.roleId,
      );
      return {
        ...credential.family.user.personalProfile,
        roleId: membership.roleId,
        ...(credential.family.user.email
          ? { email: credential.family.user.email }
          : {}),
        ...(membership.tenant.name
          ? { organizationName: membership.tenant.name }
          : {}),
        ...(membership.tenant.memberships[0]?.user.planSelection?.planId
          ? {
              planId:
                membership.tenant.memberships[0].user.planSelection.planId,
            }
          : {}),
        ...(siteCount === undefined ? {} : { siteCount }),
      };
    },
    async rotateRefresh(input: {
      credentialDigest: string;
      accessCredentialDigest: string;
      refreshCredentialDigest: string;
      now: Date;
      accessExpiresAt: Date;
      refreshExpiresAt: Date;
    }): Promise<
      | {
          status: 'accepted';
          viewer: { firstName: string; lastName: string; roleId: string };
        }
      | { status: 'rejected' }
    > {
      return prisma.$transaction(async (transaction) => {
        const credential =
          await transaction.applicationSessionCredential.findUnique({
            where: { credentialDigest: input.credentialDigest },
            select: {
              id: true,
              kind: true,
              expiresAt: true,
              consumedAt: true,
              family: {
                select: {
                  id: true,
                  userId: true,
                  tenantId: true,
                  absoluteExpiresAt: true,
                  revokedAt: true,
                  user: {
                    select: {
                      email: true,
                      personalProfile: {
                        select: { firstName: true, lastName: true },
                      },
                    },
                  },
                },
              },
            },
          });
        if (
          credential?.kind !== 'REFRESH' ||
          credential.expiresAt <= input.now ||
          credential.family.revokedAt ||
          credential.family.absoluteExpiresAt <= input.now ||
          !credential.family.user.personalProfile
        )
          return { status: 'rejected' } as const;
        if (credential.consumedAt) {
          await transaction.applicationSessionFamily.update({
            where: { id: credential.family.id },
            data: {
              revokedAt: input.now,
              revocationReason: 'refresh_reuse',
            },
          });
          recordEvent('dashboard_refresh_reuse_revoked');
          return { status: 'rejected' } as const;
        }
        const membership = await transaction.membership.findUnique({
          where: {
            userId_tenantId: {
              userId: credential.family.userId,
              tenantId: credential.family.tenantId,
            },
          },
          select: {
            id: true,
            roleId: true,
            tenant: {
              select: {
                name: true,
                memberships: {
                  where: { roleId: 'owner' },
                  take: 1,
                  select: {
                    user: {
                      select: { planSelection: { select: { planId: true } } },
                    },
                  },
                },
              },
            },
          },
        });
        if (!membership) {
          recordEvent('dashboard_membership_rejected');
          return { status: 'rejected' } as const;
        }
        const siteCount = await countAccessibleSites(
          transaction,
          credential.family.tenantId,
          membership.id,
          membership.roleId,
        );
        const consumed =
          await transaction.applicationSessionCredential.updateMany({
            where: { id: credential.id, consumedAt: null },
            data: { consumedAt: input.now },
          });
        if (consumed.count !== 1) {
          await transaction.applicationSessionFamily.update({
            where: { id: credential.family.id },
            data: {
              revokedAt: input.now,
              revocationReason: 'refresh_reuse',
            },
          });
          recordEvent('dashboard_refresh_reuse_revoked');
          return { status: 'rejected' } as const;
        }
        const absoluteExpiresAt = credential.family.absoluteExpiresAt;
        await transaction.applicationSessionCredential.createMany({
          data: [
            {
              familyId: credential.family.id,
              kind: 'ACCESS',
              credentialDigest: input.accessCredentialDigest,
              expiresAt:
                input.accessExpiresAt < absoluteExpiresAt
                  ? input.accessExpiresAt
                  : absoluteExpiresAt,
            },
            {
              familyId: credential.family.id,
              kind: 'REFRESH',
              credentialDigest: input.refreshCredentialDigest,
              expiresAt:
                input.refreshExpiresAt < absoluteExpiresAt
                  ? input.refreshExpiresAt
                  : absoluteExpiresAt,
            },
          ],
        });
        return {
          status: 'accepted' as const,
          viewer: {
            ...credential.family.user.personalProfile,
            roleId: membership.roleId,
            ...(credential.family.user.email
              ? { email: credential.family.user.email }
              : {}),
            ...(membership.tenant.name
              ? { organizationName: membership.tenant.name }
              : {}),
            ...(membership.tenant.memberships[0]?.user.planSelection?.planId
              ? {
                  planId:
                    membership.tenant.memberships[0].user.planSelection.planId,
                }
              : {}),
            ...(siteCount === undefined ? {} : { siteCount }),
          },
        };
      });
    },
  };
}
