/** @spec allocation-plan-add-area REQ-001,004,008,010 */
import { afterEach, expect, it, vi } from 'vitest';
import { createPlanAreasApi, PlanAreaRequestError } from './plan-areas-api.js';
afterEach(() => vi.unstubAllGlobals());
it('uses separate credentialled endpoints, strict responses and guarded mutations', async () => {
  const id = crypto.randomUUID();
  const area = {
    id,
    fileId: null,
    x: 0,
    y: 0,
    width: 0.2,
    height: 0.2,
    code: 'Ar.01',
    content: '',
    orientation: 'down',
    type: 'Floor',
    function: 'Environmental',
    colour: 'Blue',
    updatedAt: new Date().toISOString(),
  };
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ areas: [area], canManageAreas: true })),
    );
  vi.stubGlobal('fetch', fetcher);
  const api = createPlanAreasApi('site', 'plan', '');
  expect((await api.load(null)).areas).toEqual([area]);
  expect(fetcher).toHaveBeenLastCalledWith(
    '/api/sites/site/allocation-plans/plan/areas',
    expect.objectContaining({ credentials: 'include', method: 'GET' }),
  );
  fetcher.mockResolvedValueOnce(
    new Response(JSON.stringify({ areas: [], canManageAreas: false })),
  );
  await api.load(id);
  expect(fetcher.mock.lastCall?.[0]).toContain(`fileId=${id}`);
  fetcher.mockResolvedValueOnce(new Response(JSON.stringify(area)));
  await api.create({
    fileId: null,
    x: 0,
    y: 0,
    width: 0.2,
    height: 0.2,
    idempotencyKey: id,
  });
  expect(fetcher.mock.lastCall?.[1]).toMatchObject({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
  });
  fetcher.mockResolvedValueOnce(new Response(JSON.stringify(area)));
  await api.update(id, { expectedUpdatedAt: area.updatedAt, content: 'x' });
  expect(fetcher.mock.lastCall?.[1]).toMatchObject({ method: 'PATCH' });
  fetcher.mockResolvedValueOnce(new Response('{"deleted":true}'));
  await api.remove(id, area.updatedAt);
  expect(fetcher.mock.lastCall?.[1]).toMatchObject({
    method: 'DELETE',
    body: JSON.stringify({ expectedUpdatedAt: area.updatedAt }),
  });
  fetcher.mockResolvedValueOnce(new Response('{}', { status: 409 }));
  await expect(
    api.update(id, { expectedUpdatedAt: area.updatedAt, content: 'x' }),
  ).rejects.toEqual(new PlanAreaRequestError(409));
  fetcher.mockResolvedValueOnce(new Response('{"signs":[]}'));
  await expect(api.load(null)).rejects.toThrow();
});
