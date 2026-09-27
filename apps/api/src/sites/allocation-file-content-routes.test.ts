import { expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp, type SitesModule } from '../app.js';
import { AllocationPlansNotFoundError } from './allocation-plans.js';

it('allocation-details-design AC-003: file endpoint validates identifiers, session and private headers', async () => {
  const siteId = '00000000-0000-4000-8000-000000000001';
  const planId = '00000000-0000-4000-8000-000000000002';
  const fileId = '00000000-0000-4000-8000-000000000003';
  const load = vi.fn().mockResolvedValue({
    mediaType: 'image/png',
    bytes: new Uint8Array([1, 2, 3]),
  });
  const sites: SitesModule = {
    load: vi.fn(),
    create: vi.fn(),
    activity: vi.fn(),
    loadAllocationPlanContent: load,
  };
  const config = {
    allowedOrigin: 'https://app.example.com',
    sitesEnabled: true,
    allocationPlansEnabled: true,
  };
  const app = createApp(
    config,
    undefined,
    undefined,
    undefined,
    undefined,
    sites,
  );
  const url = `/api/sites/${siteId}/allocation-plans/${planId}/files/${fileId}/content`;
  expect((await request(app).get(url)).status).toBe(401);
  expect(
    (
      await request(app)
        .get(url.replace(fileId, 'bad'))
        .set('Cookie', 'hansel_access=token')
    ).status,
  ).toBe(400);
  const result = await request(app)
    .get(url)
    .set('Cookie', 'hansel_access=token');
  expect(result.status).toBe(200);
  expect(load).toHaveBeenCalledWith('token', siteId, planId, fileId);
  expect(result.headers['cache-control']).toContain('no-store');
  expect(result.headers['x-content-type-options']).toBe('nosniff');
  expect(result.headers['content-security-policy']).toBe(
    "default-src 'none'; sandbox",
  );
  load.mockRejectedValueOnce(new AllocationPlansNotFoundError());
  expect(
    (await request(app).get(url).set('Cookie', 'hansel_access=token')).status,
  ).toBe(404);
  const disabled = createApp(
    { ...config, allocationPlansEnabled: false },
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
