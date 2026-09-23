/** @spec allocation-plan-comments REQ-001,005..010 */
import express from 'express';
import request from 'supertest';
import { expect, it, vi } from 'vitest';
import { registerPlanCommentRoutes } from './plan-comment-routes.js';
import {
  SignageConflictError,
  SignageNotFoundError,
  SignageForbiddenError,
} from './signage-schedule.js';
import { SignCommentValidationError } from './sign-comments.js';
const id = '00000000-0000-4000-8000-000000000001',
  base = `/api/sites/${id}/allocation-plans/${id}/files/legacy/comments`,
  origin = 'http://localhost:5173';
it('REQ-001,005..010: routes enforce feature/session/origin and dispatch every plan operation', async () => {
  const feature = {
    markers: vi.fn().mockResolvedValue({ threads: [] }),
    history: vi.fn().mockResolvedValue({ comments: [] }),
    submit: vi.fn().mockResolvedValue({}),
    state: vi.fn().mockResolvedValue({}),
    people: vi.fn().mockResolvedValue({ people: [] }),
  };
  const attachments = {
    initiate: vi.fn().mockResolvedValue({ id }),
    complete: vi.fn().mockResolvedValue({ id }),
    discard: vi.fn().mockResolvedValue(undefined),
    download: vi.fn().mockResolvedValue({
      bytes: new Uint8Array([1]),
      filename: 'test.pdf',
      mediaType: 'application/pdf',
    }),
    thumbnail: vi.fn().mockResolvedValue({ bytes: new Uint8Array([1]) }),
    cleanup: vi.fn(),
  };
  const resolve = vi.fn().mockResolvedValue({
      tenantId: id,
      membershipId: id,
      userId: id,
      roleId: 'viewer',
      email: 'test@example.test',
    }),
    options = {
      enabled: true,
      allowedOrigin: origin,
      resolve,
      record: vi.fn(),
      feature,
      attachments,
    };
  const app = express();
  app.use(express.json());
  registerPlanCommentRoutes(app, options);
  const get = (path: string) =>
    request(app).get(path).set('Cookie', 'hansel_access=test');
  const post = (path: string, body: object = {}) =>
    request(app)
      .post(path)
      .set('Origin', origin)
      .set('Cookie', 'hansel_access=test')
      .send(body);
  expect((await request(app).get(base)).status).toBe(401);
  expect((await request(app).post(base)).status).toBe(403);
  expect((await get(base)).status).toBe(200);
  expect(
    (
      await get(
        `${base}?cursor=${encodeURIComponent(JSON.stringify({ id, createdAt: new Date().toISOString() }))}`,
      )
    ).status,
  ).toBe(200);
  expect((await get(`${base}/${id}`)).status).toBe(200);
  expect((await get(`${base}/people?q=Test`)).status).toBe(200);
  expect(
    (
      await post(base, {
        idempotencyKey: id,
        body: 'Test',
        mentions: [],
        attachmentIds: [],
        threadId: null,
        x: 0.5,
        y: 0.5,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await request(app)
        .put(`${base}/${id}/state`)
        .set('Origin', origin)
        .set('Cookie', 'hansel_access=test')
        .send({ resolved: true, expectedUpdatedAt: new Date().toISOString() })
    ).status,
  ).toBe(200);
  expect(
    (
      await post(`${base}/attachments`, {
        idempotencyKey: id,
        filename: 'test.pdf',
        mediaType: 'application/pdf',
        byteSize: 1,
        checksumSha256: 'a'.repeat(43) + '=',
      })
    ).status,
  ).toBe(200);
  expect((await post(`${base}/attachments/${id}`)).status).toBe(200);
  expect((await get(`${base}/attachments/${id}/download`)).status).toBe(200);
  expect((await get(`${base}/attachments/${id}/thumbnail`)).status).toBe(200);
  expect(
    (
      await request(app)
        .delete(`${base}/attachments/${id}`)
        .set('Origin', origin)
        .set('Cookie', 'hansel_access=test')
    ).status,
  ).toBe(200);
  expect((await get(`${base}/attachments/${id}`)).status).toBe(405);
  expect((await post(`${base}/${id}`)).status).toBe(405);
  expect((await get(`${base}?cursor=bad`)).status).toBe(400);
  for (const [error, status] of [
    [new SignageConflictError(), 409],
    [new SignageNotFoundError(), 404],
    [new SignageForbiddenError(), 403],
    [new SignCommentValidationError('invalid'), 422],
    [new Error('offline'), 503],
  ] as const) {
    feature.markers.mockRejectedValueOnce(error);
    expect((await get(base)).status).toBe(status);
  }
  options.enabled = false;
  expect((await get(base)).status).toBe(404);
});
