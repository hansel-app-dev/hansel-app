/** @spec library-files REQ-003..008 */
import express from 'express';
import request from 'supertest';
import { afterEach, it, vi } from 'vitest';
import type { Server } from 'node:http';
import { registerLibraryFileRoutes } from './library-file-routes.js';
import {
  SignageForbiddenError,
  SignageNotFoundError,
  SignageConflictError,
} from './signage-schedule.js';
const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) reject(error);
            else resolve();
          });
        }),
    ),
  );
});
const id = '00000000-0000-4000-8000-000000000001',
  origin = 'http://localhost:5173';
function setup(enabled = true) {
  const app = express();
  app.use(express.json());
  const feature = {
    list: vi.fn().mockResolvedValue({ files: [], nextCursor: null }),
    download: vi.fn().mockResolvedValue({
      filename: 'f.pdf',
      mediaType: 'application/pdf',
      bytes: Buffer.from('%PDF-file'),
    }),
    thumbnail: vi
      .fn()
      .mockResolvedValue({ mediaType: 'image/png', bytes: Buffer.from('png') }),
    link: vi.fn().mockResolvedValue({ items: [] }),
    createPlan: vi.fn().mockResolvedValue({ plan: { id } }),
  };
  const resolve = vi.fn().mockResolvedValue({
    tenantId: id,
    userId: id,
    membershipId: id,
    roleId: 'owner',
    email: 'owner@example.com',
  });
  registerLibraryFileRoutes(app, {
    enabled,
    allowedOrigin: origin,
    feature,
    resolve,
    record: vi.fn(),
  });
  const server = app.listen(0);
  servers.push(server);
  return { http: () => request(server), feature, resolve };
}
it('library-files routes scope reads and linking, enforce Origin and reject invalid requests', async () => {
  const { http, feature, resolve } = setup();
  await setup(false).http().get('/api/library-files').expect(404);
  await http().get('/api/library-files').expect(401);
  resolve.mockResolvedValueOnce(null);
  await http()
    .get('/api/library-files')
    .set('Cookie', 'hansel_access=token')
    .expect(401);
  await http().get('/api/library-files/not-uuid/download').expect(400);
  await http()
    .get('/api/library-files?kind=video')
    .set('Cookie', 'hansel_access=token')
    .expect(400);
  await http()
    .get('/api/library-files?q=floor')
    .set('Cookie', 'other=1; hansel_access=token')
    .expect(200);
  await http()
    .get(`/api/library-files/${id}/download`)
    .set('Cookie', 'hansel_access=token')
    .expect(200);
  await http()
    .get(`/api/library-files/${id}/thumbnail`)
    .set('Cookie', 'hansel_access=token')
    .expect(200);
  const plan = `/api/sites/${id}/library-plans`,
    docs = `/api/sites/${id}/signs/${id}/library-documents`,
    photos = `/api/sites/${id}/signs/${id}/library-photos`;
  await http()
    .post(plan)
    .set('Cookie', 'hansel_access=token')
    .send({})
    .expect(403);
  for (const path of [plan, docs])
    await http()
      .post(path)
      .set('Origin', origin)
      .set('Cookie', 'hansel_access=token')
      .send({})
      .expect(400);
  await http()
    .post(plan)
    .set('Origin', origin)
    .set('Cookie', 'hansel_access=token')
    .send({ fileId: id, name: 'Floor', idempotencyKey: id })
    .expect(200);
  for (const path of [docs, photos])
    await http()
      .post(path)
      .set('Origin', origin)
      .set('Cookie', 'hansel_access=token')
      .send({ fileIds: [id], idempotencyKey: id })
      .expect(200);
  await http()
    .patch('/api/library-files')
    .set('Origin', origin)
    .set('Cookie', 'hansel_access=token')
    .expect(405);
  await http().get(plan).set('Cookie', 'hansel_access=token').expect(405);
  for (const [error, status] of [
    [new SignageForbiddenError(), 403],
    [new SignageNotFoundError(), 404],
    [new SignageConflictError(), 409],
    [new Error('private'), 503],
  ] as const) {
    feature.list.mockRejectedValueOnce(error);
    await http()
      .get('/api/library-files')
      .set('Cookie', 'hansel_access=token')
      .expect(status);
  }
});
