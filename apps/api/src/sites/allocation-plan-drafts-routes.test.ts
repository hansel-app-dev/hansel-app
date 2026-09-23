import { expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp, type SitesModule } from '../app.js';
import { AllocationPlanUploadRejectedError } from './allocation-plans.js';

it('REQ-001, REQ-008: draft routes enforce feature flag, session, origin, strict bodies and categorical failures', async () => {
  const siteId = '00000000-0000-4000-8000-000000000001';
  const sites: SitesModule = {
    load: vi.fn(),
    create: vi.fn(),
    activity: vi.fn(),
    verifyAllocationPlanDraft: vi
      .fn()
      .mockResolvedValue({ uploadId: siteId, verified: true }),
    commitAllocationPlanDraft: vi
      .fn()
      .mockRejectedValue(new AllocationPlanUploadRejectedError()),
  };
  const config = {
    allowedOrigin: 'https://app.example.com',
    sitesEnabled: true,
    allocationPlansEnabled: true,
    allocationPlanDraftsEnabled: true,
  };
  const app = createApp(
    config,
    undefined,
    undefined,
    undefined,
    undefined,
    sites,
  );
  const url = `/api/sites/${siteId}/allocation-plan-drafts`;
  expect(
    (await request(app).post(url).set('Origin', config.allowedOrigin).send({}))
      .status,
  ).toBe(401);
  expect(
    (
      await request(app)
        .post(url)
        .set('Cookie', 'hansel_access=token')
        .set('Origin', 'https://evil.test')
        .send({})
    ).status,
  ).toBe(403);
  expect(
    (
      await request(app)
        .post(url)
        .set('Cookie', 'hansel_access=token')
        .set('Origin', config.allowedOrigin)
        .send({ files: [] })
    ).status,
  ).toBe(400);
  const verified = await request(app)
    .post(`${url}/${siteId}/verify`)
    .set('Cookie', 'hansel_access=token')
    .set('Origin', config.allowedOrigin)
    .send({});
  expect(verified.status).toBe(200);
  expect(verified.body).toEqual({ uploadId: siteId, verified: true });
  expect(verified.headers['cache-control']).toContain('no-store');
  expect(
    (
      await request(app)
        .post(`${url}/commit`)
        .set('Cookie', 'hansel_access=token')
        .set('Origin', config.allowedOrigin)
        .send({
          name: 'Plan',
          idempotencyKey: 'x'.repeat(32),
          uploadIds: [siteId],
        })
    ).status,
  ).toBe(409);
  // allocation-plan-single-file REQ-001: no backend mutation for invalid cardinality.
  for (const uploadIds of [
    [],
    [siteId, '00000000-0000-4000-8000-000000000002'],
  ]) {
    expect(
      (
        await request(app)
          .post(`${url}/commit`)
          .set('Cookie', 'hansel_access=token')
          .set('Origin', config.allowedOrigin)
          .send({ name: 'Plan', idempotencyKey: 'x'.repeat(32), uploadIds })
      ).status,
    ).toBe(400);
  }
  // eslint-disable-next-line @typescript-eslint/unbound-method -- inspect mock call count only
  expect(sites.commitAllocationPlanDraft).toHaveBeenCalledOnce();
  const disabled = createApp(
    { ...config, allocationPlanDraftsEnabled: false },
    undefined,
    undefined,
    undefined,
    undefined,
    sites,
  );
  expect((await request(disabled).post(url).send({})).status).toBe(404);
});
