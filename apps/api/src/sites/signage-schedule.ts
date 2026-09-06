/** @spec site-signage-schedule REQ-002..REQ-017 */
import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  Sign,
  SignType,
  SignageScheduleResponse,
} from '@hansel/contracts';
import type { ApplicationPrincipal } from './sites.js';
import { hasOrganizationCapability } from './permissions.js';

export class SignageNotFoundError extends Error {}
export class SignageForbiddenError extends Error {}
export class SignageConflictError extends Error {}
const accessWhere = (
  principal: ApplicationPrincipal,
): Prisma.SiteWhereInput => ({
  tenantId: principal.tenantId,
  ...(principal.roleId === 'owner'
    ? {}
    : {
        OR: [
          { accessScope: 'ORGANIZATION' },
          { createdByMembershipId: principal.membershipId },
          { grants: { some: { membershipId: principal.membershipId } } },
        ],
      }),
});
const canManage = (principal: ApplicationPrincipal) =>
  hasOrganizationCapability(principal.roleId, 'MANAGE_SIGNS');
const signDto = (record: {
  id: string;
  signTypeId: string;
  code: string;
  quantity: number;
  location: string;
  content: string;
  comments: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): Sign => ({
  ...record,
  status: record.status as Sign['status'],
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
});
const typeDto = (record: {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
  signs: Parameters<typeof signDto>[0][];
}): SignType => ({
  id: record.id,
  name: record.name,
  color: record.color as SignType['color'],
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
  signs: record.signs.map(signDto),
  quantityTotal: record.signs.reduce((sum, sign) => sum + sign.quantity, 0),
});

export function createSignageScheduleFeature(prisma: PrismaClient) {
  const authorize = async (
    principal: ApplicationPrincipal,
    siteId: string,
    mutation = false,
  ) => {
    if (mutation && !canManage(principal)) throw new SignageForbiddenError();
    if (
      (await prisma.site.count({
        where: { ...accessWhere(principal), id: siteId },
      })) !== 1
    )
      throw new SignageNotFoundError();
  };
  const loadType = async (
    principal: ApplicationPrincipal,
    siteId: string,
    id: string,
  ) => {
    const record = await prisma.signType.findFirst({
      where: { id, tenantId: principal.tenantId, siteId },
      include: {
        signs: { orderBy: [{ normalizedCode: 'asc' }, { id: 'asc' }] },
      },
    });
    if (!record) throw new SignageNotFoundError();
    return typeDto(record);
  };
  const loadSign = async (
    principal: ApplicationPrincipal,
    siteId: string,
    id: string,
  ) => {
    const record = await prisma.sign.findFirst({
      where: { id, tenantId: principal.tenantId, siteId },
    });
    if (!record) throw new SignageNotFoundError();
    return signDto(record);
  };
  return {
    async load(
      principal: ApplicationPrincipal,
      siteId: string,
    ): Promise<SignageScheduleResponse> {
      await authorize(principal, siteId);
      const records = await prisma.signType.findMany({
        where: { tenantId: principal.tenantId, siteId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: {
          signs: { orderBy: [{ normalizedCode: 'asc' }, { id: 'asc' }] },
        },
      });
      return {
        canManageSigns: canManage(principal),
        signTypes: records.map(typeDto),
      };
    },
    async createType(
      principal: ApplicationPrincipal,
      siteId: string,
      name: string,
    ): Promise<SignType> {
      await authorize(principal, siteId, true);
      const count = await prisma.signType.count({
        where: { tenantId: principal.tenantId, siteId },
      });
      if (count >= 100) throw new SignageConflictError();
      const palette = ['SLATE', 'RED', 'TEAL'] as const;
      try {
        const created = await prisma.signType.create({
          data: {
            tenantId: principal.tenantId,
            siteId,
            name,
            normalizedName: name.toLocaleLowerCase(),
            color: palette[count % palette.length] ?? 'SLATE',
          },
          select: { id: true },
        });
        return await loadType(principal, siteId, created.id);
      } catch {
        throw new SignageConflictError();
      }
    },
    async updateType(
      principal: ApplicationPrincipal,
      siteId: string,
      id: string,
      name: string,
      expectedUpdatedAt: string,
    ): Promise<SignType> {
      await authorize(principal, siteId, true);
      try {
        const result = await prisma.signType.updateMany({
          where: {
            id,
            tenantId: principal.tenantId,
            siteId,
            updatedAt: new Date(expectedUpdatedAt),
          },
          data: { name, normalizedName: name.toLocaleLowerCase() },
        });
        if (result.count !== 1) throw new SignageConflictError();
        return await loadType(principal, siteId, id);
      } catch (error) {
        if (error instanceof SignageConflictError) throw error;
        throw new SignageConflictError();
      }
    },
    async createSign(
      principal: ApplicationPrincipal,
      siteId: string,
      typeId: string,
      input: {
        code: string;
        quantity: number;
        location: string;
        content: string;
        comments: string;
        status: Sign['status'];
      },
    ): Promise<Sign> {
      await authorize(principal, siteId, true);
      if (
        (await prisma.sign.count({
          where: { tenantId: principal.tenantId, siteId },
        })) >= 5000
      )
        throw new SignageConflictError();
      if (
        !(await prisma.signType.count({
          where: { id: typeId, tenantId: principal.tenantId, siteId },
        }))
      )
        throw new SignageNotFoundError();
      try {
        const record = await prisma.sign.create({
          data: {
            tenantId: principal.tenantId,
            siteId,
            signTypeId: typeId,
            ...input,
            normalizedCode: input.code.toLocaleLowerCase(),
          },
        });
        return signDto(record);
      } catch {
        throw new SignageConflictError();
      }
    },
    async updateSign(
      principal: ApplicationPrincipal,
      siteId: string,
      id: string,
      input: {
        field: string;
        value: string | number;
        expectedUpdatedAt: string;
      },
    ): Promise<Sign> {
      await authorize(principal, siteId, true);
      const data: Record<string, string | number> = {
        [input.field]: input.value,
      };
      if (input.field === 'code')
        data.normalizedCode = String(input.value).toLocaleLowerCase();
      try {
        const result = await prisma.sign.updateMany({
          where: {
            id,
            tenantId: principal.tenantId,
            siteId,
            updatedAt: new Date(input.expectedUpdatedAt),
          },
          data,
        });
        if (result.count !== 1) throw new SignageConflictError();
        return await loadSign(principal, siteId, id);
      } catch (error) {
        if (error instanceof SignageConflictError) throw error;
        throw new SignageConflictError();
      }
    },
  };
}
