import express from 'express';
import request from 'supertest';
import { expect, it, vi } from 'vitest';
import { registerSignDocumentRoutes } from './sign-document-routes.js';
const siteId = 'f4e82388-a951-4d52-b6d6-0b5cde568763';
const signId = '33e82388-a951-4d52-b6d6-0b5cde568763';
const documentId = '44e82388-a951-4d52-b6d6-0b5cde568763';
const path = `/api/sites/${siteId}/signs/${signId}/documents`;
function setup(enabled = true) {
  const app = express();
  app.use(express.json());
  const list = vi.fn().mockResolvedValue({ documents: [], nextCursor: null });
  registerSignDocumentRoutes(app, {
    enabled,
    allowedOrigin: 'http://localhost:5173',
    resolve: () =>
      Promise.resolve({
        tenantId: siteId,
        membershipId: signId,
        userId: signId,
        roleId: 'owner',
        email: 'test@example.test',
      }),
    feature: {
      list,
      initiate: vi.fn(),
      complete: vi.fn(),
      cleanup: vi.fn(),
      download: () =>
        Promise.resolve({
          filename: 'résumé.pdf',
          mediaType: 'application/pdf',
          bytes: new TextEncoder().encode('%PDF-test'),
        }),
    },
    record: vi.fn(),
  });
  return { app, list };
}
it('sign-documents REQ-006,008: private authentication, flag and Origin boundaries', async () => {
  const { app, list } = setup();
  expect((await request(app).get(path)).status).toBe(401);
  expect((await request(setup(false).app).get(path)).status).toBe(404);
  expect(
    (
      await request(app)
        .post(path)
        .set('Cookie', 'hansel_access=test')
        .set('Origin', 'https://attacker.test')
        .send({})
    ).status,
  ).toBe(403);
  expect(list).not.toHaveBeenCalled();
  expect(
    (await request(app).get(path).set('Cookie', 'hansel_access=test')).status,
  ).toBe(200);
});
it('sign-documents REQ-006: download is attachment, private and nosniff', async () => {
  const response = await request(setup().app)
    .get(`${path}/${documentId}/download`)
    .set('Cookie', 'hansel_access=test');
  expect(response.status).toBe(200);
  expect(response.headers['content-disposition']).toContain('attachment;');
  expect(response.headers['cache-control']).toContain('no-store');
  expect(response.headers['x-content-type-options']).toBe('nosniff');
  expect(response.body).toEqual(Buffer.from('%PDF-test'));
});
