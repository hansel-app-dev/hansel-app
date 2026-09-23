/** @spec allocation-plan-add-area REQ-001,004,007..010 */
import { createHash } from 'node:crypto';
import {
  Prisma,
  type PrismaClient,
  type PlanArea as AreaRow,
} from '@prisma/client';
import {
  planAreaCreateSchema,
  planAreaPatchSchema,
  planAreaSchema,
  areaWithinBounds,
  type PlanAreaCreate,
  type PlanAreaPatch,
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
const dto = (a: AreaRow) =>
  planAreaSchema.parse({
    id: a.id,
    fileId: a.fileId,
    x: a.x,
    y: a.y,
    width: a.width,
    height: a.height,
    code: a.code,
    content: a.content,
    orientation: a.orientation,
    updatedAt: a.updatedAt.toISOString(),
    type: 'Floor',
    function: 'Environmental',
    colour: 'Blue',
  });
export function createPlanAreasFeature(prisma: PrismaClient) {
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

  async function find(
    db: Database,
    p: ApplicationPrincipal,
    siteId: string,
    planId: string,
    id: string,
  ) {
    const row = await db.planArea.findFirst({
      where: { id, tenantId: p.tenantId, siteId, planId },
    });
    if (!row) throw new SignageNotFoundError();
    return row;
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
      const areas = await prisma.planArea.findMany({
        where: { tenantId: p.tenantId, siteId, planId, fileId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 5000,
      });
      return { canManageAreas: manages(p), areas: areas.map(dto) };
    },
    async create(
      p: ApplicationPrincipal,
      siteId: string,
      planId: string,
      raw: PlanAreaCreate,
    ) {
      const input = planAreaCreateSchema.parse(raw);
      const { idempotencyKey, ...geometry } = input;
      const digest = createHash('sha256')
        .update(JSON.stringify({ siteId, planId, ...geometry }))
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
        const previous = await db.planAreaRequest.findUnique({
          where: {
            tenantId_key: { tenantId: p.tenantId, key: idempotencyKey },
          },
        });
        if (previous) {
          if (previous.digest !== digest) throw new SignageConflictError();
          return dto(await find(db, p, siteId, planId, previous.areaId));
        }
        const existing = await db.planArea.findMany({
          where: { tenantId: p.tenantId, planId },
          select: { normalizedCode: true },
          take: 5000,
        });
        if (existing.length >= 5000) throw new SignageConflictError();
        let next = 1n;
        for (const a of existing) {
          if (/^ar\.[0-9]+$/.test(a.normalizedCode)) {
            const number = BigInt(a.normalizedCode.slice(3));
            if (number >= next) next = number + 1n;
          }
        }
        const code = `Ar.${String(next).padStart(2, '0')}`;
        if (code.length > 40) throw new SignageConflictError();
        const area = await db.planArea.create({
          data: {
            tenantId: p.tenantId,
            siteId,
            planId,
            ...geometry,
            code,
            normalizedCode: code.toLowerCase(),
          },
        });
        await db.planAreaRequest.create({
          data: {
            tenantId: p.tenantId,
            siteId,
            planId,
            key: idempotencyKey,
            digest,
            areaId: area.id,
          },
        });
        return dto(area);
      });
    },
    async update(
      p: ApplicationPrincipal,
      siteId: string,
      planId: string,
      id: string,
      raw: PlanAreaPatch,
    ) {
      const { expectedUpdatedAt, ...changes } = planAreaPatchSchema.parse(raw);
      return transact(async (db) => {
        await authorize(db, p, siteId, planId, true);
        const area = await find(db, p, siteId, planId, id);
        if (
          !areaWithinBounds({
            ...area,
            x: changes.x ?? area.x,
            y: changes.y ?? area.y,
            width: changes.width ?? area.width,
            height: changes.height ?? area.height,
          })
        )
          throw new SignageConflictError();
        const result = await db.planArea.updateMany({
          where: {
            id,
            tenantId: p.tenantId,
            siteId,
            planId,
            updatedAt: new Date(expectedUpdatedAt),
          },
          data: {
            ...(changes.code === undefined
              ? {}
              : {
                  code: changes.code,
                  normalizedCode: changes.code.toLowerCase(),
                }),
            ...(changes.content === undefined
              ? {}
              : { content: changes.content }),
            ...(changes.orientation === undefined
              ? {}
              : { orientation: changes.orientation }),
            ...(changes.x === undefined || changes.y === undefined
              ? {}
              : { x: changes.x, y: changes.y }),
            width: changes.width ?? area.width,
            height: changes.height ?? area.height,
            updatedAt: new Date(
              Math.max(Date.now(), Date.parse(expectedUpdatedAt) + 1),
            ),
          },
        });
        if (result.count !== 1) throw new SignageConflictError();
        return dto(await find(db, p, siteId, planId, id));
      });
    },
    async remove(
      p: ApplicationPrincipal,
      siteId: string,
      planId: string,
      id: string,
      expectedUpdatedAt: string,
    ) {
      return transact(async (db) => {
        await authorize(db, p, siteId, planId, true);
        await find(db, p, siteId, planId, id);
        const result = await db.planArea.deleteMany({
          where: {
            id,
            tenantId: p.tenantId,
            siteId,
            planId,
            updatedAt: new Date(expectedUpdatedAt),
          },
        });
        if (result.count !== 1) throw new SignageConflictError();
      });
    },
  };
}
