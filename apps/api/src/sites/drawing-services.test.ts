import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { createPlanAreasFeature } from './plan-areas.js';
import { createPlanSignsFeature } from './plan-signs.js';
const id = '00000000-0000-4000-8000-000000000001';
const p = {
  email: 'owner@example.com',
  userId: id,
  tenantId: id,
  membershipId: id,
  roleId: 'owner',
};
const now = new Date('2026-09-01T00:00:00Z');
const known = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('race', {
    code,
    clientVersion: 'test',
  });
function setup() {
  const sign = {
    id,
    code: 'SG.001',
    content: '',
    mounting: 'Wall-mounted',
    function: 'Directional',
    colour: 'Red',
    orientation: 'left',
    updatedAt: now,
  };
  const area = {
    id,
    fileId: null,
    x: 0.2,
    y: 0.2,
    width: 0.2,
    height: 0.2,
    code: 'Ar.01',
    content: '',
    orientation: 'left',
    updatedAt: now,
  };
  const placement = {
    id,
    signId: id,
    fileId: null,
    x: 0.2,
    y: 0.2,
    endX: null as number | null,
    endY: null as number | null,
    placementKind: 'point',
    sign,
  };
  const request = {
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
  };
  const signs = {
    findMany: vi.fn().mockResolvedValue([]),
    create: vi
      .fn()
      .mockImplementation(({ data }: { data: typeof sign }) =>
        Promise.resolve(Object.assign(sign, data)),
      ),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
  };
  const places = {
    findMany: vi.fn().mockResolvedValue([placement]),
    findFirst: vi.fn().mockResolvedValue(placement),
    create: vi
      .fn()
      .mockImplementation(({ data }: { data: typeof placement }) =>
        Promise.resolve(Object.assign(placement, data)),
      ),
    update: vi.fn(),
  };
  const areas = {
    findMany: vi.fn().mockResolvedValue([area]),
    findFirst: vi.fn().mockResolvedValue(area),
    create: vi
      .fn()
      .mockImplementation(({ data }: { data: typeof area }) =>
        Promise.resolve(Object.assign(area, data)),
      ),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
  };
  const db = {
    site: { count: vi.fn().mockResolvedValue(1) },
    allocationPlan: {
      findFirst: vi.fn().mockResolvedValue({ objectKey: 'legacy' }),
    },
    allocationPlanUpload: { count: vi.fn().mockResolvedValue(1) },
    sign: signs,
    signPlacement: places,
    signType: {
      findUnique: vi.fn().mockResolvedValue({ id }),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id }),
    },
    planSignRequest: request,
    planAreaRequest: request,
    planArea: areas,
    $transaction: vi
      .fn()
      .mockImplementation((work: (tx: unknown) => Promise<unknown>) =>
        Promise.resolve(work(db)),
      ),
  };
  return {
    db,
    sign,
    area,
    placement,
    request,
    signs,
    places,
    areas,
    signApi: createPlanSignsFeature(db as never),
    areaApi: createPlanAreasFeature(db as never),
  };
}
for (const kind of ['sign', 'area'] as const)
  describe(`${kind} drawing service [allocation-plan-signs/allocation-plan-add-area REQ-001,004,007..012]`, () => {
    const args = [p, id, id] as const;
    const raw = { fileId: null, x: 0.2, y: 0.2, idempotencyKey: id };
    function actions(s: ReturnType<typeof setup>) {
      return {
        load: (actor = p, fileId: string | null = null) =>
          kind === 'sign'
            ? s.signApi.load(actor, id, id, fileId)
            : s.areaApi.load(actor, id, id, fileId),
        create: () =>
          kind === 'sign'
            ? s.signApi.create(...args, raw)
            : s.areaApi.create(...args, { ...raw, width: 0.2, height: 0.2 }),
        update: (geometry = false) =>
          kind === 'sign'
            ? s.signApi.update(...args, id, {
                expectedUpdatedAt: now.toISOString(),
                ...(geometry
                  ? { x: 0.3, y: 0.3 }
                  : {
                      code: 'New',
                      content: 'Text',
                      mounting: 'Floor',
                      function: 'Informational',
                      colour: 'Red',
                      orientation: 'right',
                    }),
              })
            : s.areaApi.update(...args, id, {
                expectedUpdatedAt: now.toISOString(),
                ...(geometry
                  ? { x: 0.3, y: 0.3, width: 0.3, height: 0.3 }
                  : { code: 'New', content: 'Text', orientation: 'right' }),
              }),
        remove: () =>
          kind === 'sign'
            ? s.signApi.remove(...args, id, now.toISOString())
            : s.areaApi.remove(...args, id, now.toISOString()),
      };
    }
    it('scopes loads to accessible Sites and verified files, requiring management for mutations', async () => {
      const s = setup(),
        a = actions(s);
      await expect(a.load()).resolves.toMatchObject(
        kind === 'sign' ? { canManageSigns: true } : { canManageAreas: true },
      );
      await a.load({ ...p, roleId: 'viewer' }, id);
      expect(s.db.allocationPlanUpload.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'COMPLETED',
            verifiedAt: { not: null },
          }),
        }),
      );
      s.db.site.count.mockResolvedValueOnce(0);
      await expect(a.load()).rejects.toThrow();
      s.db.allocationPlan.findFirst.mockResolvedValueOnce(null);
      await expect(a.load()).rejects.toThrow();
      s.db.allocationPlan.findFirst.mockResolvedValueOnce({ objectKey: null });
      await expect(a.load()).rejects.toThrow();
      s.db.allocationPlanUpload.count.mockResolvedValueOnce(0);
      await expect(a.load(p, id)).rejects.toThrow();
      const api = kind === 'sign' ? s.signApi : s.areaApi;
      await expect(
        api.remove({ ...p, roleId: 'viewer' }, id, id, id, now.toISOString()),
      ).rejects.toThrow();
    });
    it('creates and replays a payload-bound intent, assigns available codes and prevents capacity overflow', async () => {
      const s = setup(),
        a = actions(s);
      s.areas.findMany.mockResolvedValue([
        { normalizedCode: 'ar.02' },
        { normalizedCode: 'custom' },
        { normalizedCode: 'ar.01' },
      ]);
      s.signs.findMany.mockResolvedValue([{ normalizedCode: 'sg.001' }]);
      s.db.signType.findUnique.mockResolvedValueOnce(null);
      const result = await a.create();
      expect(result.code).toBe(kind === 'sign' ? 'SG.002' : 'Ar.03');
      const data = s.request.create.mock.calls[0]?.[0];
      if (!data) throw new Error('Expected persisted idempotency digest');
      s.request.findUnique.mockResolvedValueOnce({
        ...data.data,
        signId: id,
        areaId: id,
      });
      await expect(a.create()).resolves.toMatchObject({ id });
      s.request.findUnique.mockResolvedValueOnce({ digest: 'changed' });
      await expect(a.create()).rejects.toThrow();
      const model = kind === 'sign' ? s.signs : s.areas;
      model.findMany.mockResolvedValueOnce(
        Array.from({ length: 5000 }, () => ({ normalizedCode: 'custom' })),
      );
      await expect(a.create()).rejects.toThrow();
      if (kind === 'sign') {
        s.db.signType.findUnique.mockResolvedValueOnce(null);
        s.db.signType.count.mockResolvedValueOnce(100);
        await expect(a.create()).rejects.toThrow();
      } else {
        s.areas.findMany.mockResolvedValueOnce([
          { normalizedCode: 'ar.' + '9'.repeat(40) },
        ]);
        await expect(a.create()).rejects.toThrow();
      }
    });
    it('updates fields and geometry with version tokens, and rejects stale deletion or missing placements', async () => {
      const s = setup(),
        a = actions(s);
      await a.update();
      await a.update(true);
      await a.remove();
      const model = kind === 'sign' ? s.signs : s.areas;
      model.updateMany.mockResolvedValueOnce({ count: 0 });
      await expect(a.update()).rejects.toThrow();
      model.deleteMany.mockResolvedValueOnce({ count: 0 });
      await expect(a.remove()).rejects.toThrow();
      const finder = kind === 'sign' ? s.places : s.areas;
      finder.findFirst.mockResolvedValueOnce(null);
      await expect(a.update()).rejects.toThrow();
      if (kind === 'area') {
        s.area.width = 0.8;
        await expect(
          s.areaApi.update(...args, id, {
            x: 0.4,
            y: 0.2,
            expectedUpdatedAt: now.toISOString(),
          }),
        ).rejects.toThrow();
        await s.areaApi.update(...args, id, {
          content: 'Only content',
          expectedUpdatedAt: now.toISOString(),
        });
      }
    });
    it('retries serialization/unique races within the bounded budget and propagates dependency errors', async () => {
      const s = setup(),
        a = actions(s);
      s.db.$transaction.mockRejectedValueOnce(known('P2034'));
      await a.create();
      s.db.$transaction.mockRejectedValue(known('P2002'));
      await expect(a.create()).rejects.toThrow();
      expect(s.db.$transaction).toHaveBeenCalledTimes(6);
      for (const error of [new Error('offline'), known('P2000')]) {
        s.db.$transaction.mockRejectedValueOnce(error);
        await expect(a.create()).rejects.toBe(error);
      }
    });
  });
it('allocation-plan-linear-tool REQ-008,010: persists complete distinct endpoints and rejects edits mismatching saved kind', async () => {
  const s = setup(),
    args = [p, id, id] as const;
  const raw = {
    fileId: null,
    x: 0.2,
    y: 0.2,
    endX: 0.5,
    endY: 0.5,
    placementKind: 'linear' as const,
    mounting: 'Safety Decal' as const,
    idempotencyKey: id,
  };
  const result = await s.signApi.create(...args, raw);
  expect(result).toMatchObject({
    code: 'Pr.01',
    placementKind: 'linear',
    endX: 0.5,
  });
  await s.signApi.update(...args, id, {
    expectedUpdatedAt: now.toISOString(),
    x: 0.3,
    y: 0.3,
    endX: 0.6,
    endY: 0.6,
  });
  expect(s.places.update).toHaveBeenCalledWith({
    where: { signId: id },
    data: { x: 0.3, y: 0.3, endX: 0.6, endY: 0.6 },
  });
  await expect(
    s.signApi.update(...args, id, {
      expectedUpdatedAt: now.toISOString(),
      x: 0.3,
      y: 0.3,
    }),
  ).rejects.toThrow();
  s.placement.placementKind = 'point';
  s.placement.endX = null;
  s.placement.endY = null;
  await expect(
    s.signApi.update(...args, id, {
      expectedUpdatedAt: now.toISOString(),
      x: 0.3,
      y: 0.3,
      endX: 0.6,
      endY: 0.6,
    }),
  ).rejects.toThrow();
});
