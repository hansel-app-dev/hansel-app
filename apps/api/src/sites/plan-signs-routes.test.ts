import { expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp, type SitesModule } from '../app.js';

it('allocation-plan-signs REQ-011: requires session, exact Origin, strict body and enabled flag', async () => {
  const siteId = '00000000-0000-4000-8000-000000000001';
  const planId = '00000000-0000-4000-8000-000000000002';
  const create = vi.fn();
  const sites: SitesModule = {
    load: vi.fn(),
    create: vi.fn(),
    activity: vi.fn(),
    planSigns: {
      load: vi.fn().mockResolvedValue({ signs: [], canManageSigns: true }),
      create,
      update: vi.fn(),
      remove: vi.fn(),
    },
  };
  const config = {
    allowedOrigin: 'https://app.example.com',
    sitesEnabled: true,
    allocationPlanSignsEnabled: true,
  };
  const app = createApp(
    config,
    undefined,
    undefined,
    undefined,
    undefined,
    sites,
  );
  const url = `/api/sites/${siteId}/allocation-plans/${planId}/signs`;
  expect((await request(app).get(url)).status).toBe(401);
  const loaded = await request(app)
    .get(url)
    .set('Cookie', 'hansel_access=token');
  expect(loaded.status).toBe(200);
  expect(loaded.headers['cache-control']).toContain('no-store');
  expect(
    (await request(app).post(url).set('Cookie', 'hansel_access=token').send({}))
      .status,
  ).toBe(403);
  expect(
    (
      await request(app)
        .post(url)
        .set('Cookie', 'hansel_access=token')
        .set('Origin', config.allowedOrigin)
        .send({ x: 9, y: 0 })
    ).status,
  ).toBe(400);
  expect(create).not.toHaveBeenCalled();
  const disabled = createApp(
    { ...config, allocationPlanSignsEnabled: false },
    undefined,
    undefined,
    undefined,
    undefined,
    sites,
  );
  expect(
    (await request(disabled).get(url).set('Cookie', 'hansel_access=token'))
      .status,
  ).toBe(404);
});
