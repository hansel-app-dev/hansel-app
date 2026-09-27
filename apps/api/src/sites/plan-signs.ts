/** @spec allocation-plan-signs REQ-001..004, REQ-007..012 */
import { ZodError } from 'zod';
import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import {
  planSignCreateSchema,
  planSignPatchSchema,
  planSignSchema,
  type PlanSignCreate,
  type PlanSignPatch,
} from '@hansel/contracts';
import type { ApplicationPrincipal } from './sites.js';
import { hasOrganizationCapability } from './permissions.js';
import {
  SignageConflictError,
  SignageForbiddenError,
  SignageNotFoundError,
} from './signage-schedule.js';

type Database = Prisma.TransactionClient;
const manages = (p: ApplicationPrincipal) =>
  hasOrganizationCapability(p.roleId, 'MANAGE_SIGNS');
const dto = (
  row: Prisma.SignPlacementGetPayload<{ include: { sign: true } }>,
) =>
  planSignSchema.parse({
    id: row.signId,
    fileId: row.fileId,
    placementKind: row.placementKind,
    endX: row.endX,
    endY: row.endY,
    x: row.x,
    y: row.y,
    code: row.sign.code,
    content: row.sign.content,
    updatedAt: row.sign.updatedAt.toISOString(),
    mounting: row.sign.mounting,
    function: row.sign.function,
    colour: row.sign.colour,
    orientation: row.sign.orientation,
  });

export function createPlanSignsFeature(prisma: PrismaClient) {
  async function authorize(
    db: Database,
    p: ApplicationPrincipal,
    siteId: string,
    planId: string,
    mutation: boolean,
  ) {
    if (mutation && !manages(p)) throw new SignageForbiddenError();
    const site = await db.site.count({
      where: {
        id: siteId,
        tenantId: p.tenantId,
        ...(p.roleId === 'owner'
          ? {}
          : {
              OR: [
                { accessScope: 'ORGANIZATION' },
                { createdByMembershipId: p.membershipId },
                { grants: { some: { membershipId: p.membershipId } } },
              ],
            }),
      },
    });
    if (!site) throw new SignageNotFoundError();
    const plan = await db.allocationPlan.findFirst({
      where: { id: planId, siteId, tenantId: p.tenantId },
    });
    if (!plan) throw new SignageNotFoundError();
    return plan;
  }
  async function file(
    db: Database,
    tenantId: string,
    siteId: string,
    planId: string,
    fileId: string | null,
    legacy: boolean,
  ) {
    if (fileId === null) {
      if (!legacy) throw new SignageNotFoundError();
      return;
    }
    if (
      !(await db.allocationPlanUpload.count({
        where: {
          id: fileId,
          tenantId,
          siteId,
          groupedPlanId: planId,
          status: 'COMPLETED',
          verifiedAt: { not: null },
        },
      }))
    )
      throw new SignageNotFoundError();
  }
  async function placed(
    db: Database,
    tenantId: string,
    siteId: string,
    planId: string,
    signId: string,
  ) {
    const row = await db.signPlacement.findFirst({
      where: { tenantId, siteId, planId, signId },
      include: { sign: true },
    });
    if (!row) throw new SignageNotFoundError();
    return row;
  }
  async function transact<T>(
    work: (db: Database) => Promise<T>,
    attempt = 0,
  ): Promise<T> {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: 'Serializable',
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2034', 'P2002'].includes(error.code)
      ) {
        if (attempt < 3) return transact(work, attempt + 1);
        throw new SignageConflictError();
      }
      throw error;
    }
  }
  return {
    async load(
      p: ApplicationPrincipal,
      siteId: string,
      planId: string,
      fileId: string | null,
    ) {
      const plan = await authorize(prisma, p, siteId, planId, false);
      await file(prisma, p.tenantId, siteId, planId, fileId, !!plan.objectKey);
      const rows = await prisma.signPlacement.findMany({
        where: { tenantId: p.tenantId, siteId, planId, fileId },
        include: { sign: true },
        orderBy: { signId: 'asc' },
        take: 5000,
      });
      return { canManageSigns: manages(p), signs: rows.map(dto) };
    },
    async create(
      p: ApplicationPrincipal,
      siteId: string,
      planId: string,
      raw: PlanSignCreate,
    ) {
      const input = planSignCreateSchema.parse(raw);
      const digest = createHash('sha256')
        .update(
          JSON.stringify({
            siteId,
            planId,
            fileId: input.fileId,
            x: input.x,
            y: input.y,
            ...(input.placementKind === 'linear'
              ? { placementKind: 'linear', endX: input.endX, endY: input.endY }
              : {}),
            // Preserve digests for legacy/default Wall-mounted requests.
            ...(input.mounting && input.mounting !== 'Wall-mounted'
              ? { mounting: input.mounting }
              : {}),
          }),
        )
        .digest('hex');
      return transact(async (db) => {
        const plan = await authorize(db, p, siteId, planId, true);
        await file(
          db,
          p.tenantId,
          siteId,
          planId,
          input.fileId,
          !!plan.objectKey,
        );
        const previous = await db.planSignRequest.findUnique({
          where: {
            tenantId_key: { tenantId: p.tenantId, key: input.idempotencyKey },
          },
        });
        if (previous) {
          if (previous.digest !== digest) throw new SignageConflictError();
          return dto(
            await placed(db, p.tenantId, siteId, planId, previous.signId),
          );
        }
        const existing = await db.sign.findMany({
          where: { tenantId: p.tenantId, siteId },
          select: { normalizedCode: true },
          take: 5000,
        });
        if (existing.length >= 5000) throw new SignageConflictError();
        const occupied = new Set(existing.map((sign) => sign.normalizedCode));
        const linear = input.placementKind === 'linear';
        const prefix = linear ? 'Pr.' : 'SG.';
        const digits = linear ? 2 : 3;
        let index = 1;
        while (
          occupied.has(
            `${prefix}${String(index).padStart(digits, '0')}`.toLowerCase(),
          )
        )
          index++;
        const code = `${prefix}${String(index).padStart(digits, '0')}`;
        let group = await db.signType.findUnique({
          where: {
            tenantId_siteId_normalizedName: {
              tenantId: p.tenantId,
              siteId,
              normalizedName: 'plan signs',
            },
          },
        });
        if (!group) {
          const count = await db.signType.count({
            where: { tenantId: p.tenantId, siteId },
          });
          if (count >= 100) throw new SignageConflictError();
          const colours = ['SLATE', 'RED', 'TEAL'] as const;
          group = await db.signType.create({
            data: {
              tenantId: p.tenantId,
              siteId,
              name: 'Plan signs',
              normalizedName: 'plan signs',
              color: colours[(count % 3) as 0 | 1 | 2],
            },
          });
        }
        const sign = await db.sign.create({
          data: {
            tenantId: p.tenantId,
            siteId,
            signTypeId: group.id,
            code,
            normalizedCode: code.toLowerCase(),
            mounting: input.mounting ?? 'Wall-mounted',
            function: linear ? 'Regulatory/Statutory' : 'Directional',
            colour: linear ? 'Orange' : 'Red',
          },
        });
        const placement = await db.signPlacement.create({
          data: {
            tenantId: p.tenantId,
            siteId,
            planId,
            fileId: input.fileId,
            signId: sign.id,
            placementKind: linear ? 'linear' : 'point',
            endX: input.endX ?? null,
            endY: input.endY ?? null,
            x: input.x,
            y: input.y,
          },
          include: { sign: true },
        });
        await db.planSignRequest.create({
          data: {
            tenantId: p.tenantId,
            siteId,
            planId,
            key: input.idempotencyKey,
            digest,
            signId: sign.id,
          },
        });
        return dto(placement);
      });
    },
    async update(
      p: ApplicationPrincipal,
      siteId: string,
      planId: string,
      signId: string,
      raw: PlanSignPatch,
    ) {
      const { expectedUpdatedAt, ...data } = planSignPatchSchema.parse(raw);
      const changes: Prisma.SignUpdateManyMutationInput = {};
      if (data.code !== undefined) {
        changes.code = data.code;
        changes.normalizedCode = data.code.toLowerCase();
      }
      if (data.content !== undefined) changes.content = data.content;
      if (data.mounting !== undefined) changes.mounting = data.mounting;
      if (data.function !== undefined) changes.function = data.function;
      if (data.colour !== undefined) changes.colour = data.colour;
      if (data.orientation !== undefined)
        changes.orientation = data.orientation;
      return transact(async (db) => {
        await authorize(db, p, siteId, planId, true);
        const placement = await placed(db, p.tenantId, siteId, planId, signId);
        // REQ-008,010: validate against persisted kind, never trust a client discriminator.
        const linear = placement.placementKind === 'linear';
        planSignSchema.parse({ ...dto(placement), ...data });
        if (
          (linear && data.x !== undefined && data.endX === undefined) ||
          (!linear && data.endX !== undefined)
        ) {
          throw new ZodError([
            {
              code: 'custom',
              path: ['endX'],
              message: 'Provide geometry matching the saved placement kind',
            },
          ]);
        }
        const result = await db.sign.updateMany({
          where: {
            id: signId,
            tenantId: p.tenantId,
            siteId,
            updatedAt: new Date(expectedUpdatedAt),
          },
          data: {
            ...changes,
            updatedAt: new Date(
              Math.max(Date.now(), new Date(expectedUpdatedAt).getTime() + 1),
            ),
          },
        });
        if (result.count !== 1) throw new SignageConflictError();
        if (data.x !== undefined && data.y !== undefined) {
          await db.signPlacement.update({
            where: { signId },
            data: {
              x: data.x,
              y: data.y,
              ...(linear && data.endX !== undefined && data.endY !== undefined
                ? { endX: data.endX, endY: data.endY }
                : {}),
            },
          });
        }
        return dto(await placed(db, p.tenantId, siteId, planId, signId));
      });
    },
    async remove(
      p: ApplicationPrincipal,
      siteId: string,
      planId: string,
      signId: string,
      expectedUpdatedAt: string,
    ) {
      return transact(async (db) => {
        await authorize(db, p, siteId, planId, true);
        await placed(db, p.tenantId, siteId, planId, signId);
        const result = await db.sign.deleteMany({
          where: {
            id: signId,
            tenantId: p.tenantId,
            siteId,
            updatedAt: new Date(expectedUpdatedAt),
          },
        });
        if (result.count !== 1) throw new SignageConflictError();
      });
    },
  };
}
