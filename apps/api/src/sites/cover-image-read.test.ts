/** @spec site-cover-image-display REQ-004, REQ-005 */
import express from 'express';
import request from 'supertest';
import { expect, it, vi } from 'vitest';
import { createCoverImageRoutes } from './cover-image.js';

function harness() {
  const prisma = {
    applicationSessionCredential: {
      findUnique: vi.fn().mockResolvedValue({
        kind: 'ACCESS',
        expiresAt: new Date(Date.now() + 60_000),
        family: {
          id: 'family',
          userId: 'user',
          tenantId: 'tenant',
          absoluteExpiresAt: new Date(Date.now() + 60_000),
        },
      }),
    },
    membership: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'member',
        tenantId: 'tenant',
        roleId: 'viewer',
      }),
    },
    site: { findFirst: vi.fn().mockResolvedValue({ id: 'site' }) },
    siteCoverImage: {
      findFirst: vi.fn().mockResolvedValue({
        objectKey: 'private-key',
        mediaType: 'image/png',
      }),
    },
  };
  const s3 = {
    send: vi.fn().mockResolvedValue({
      ContentLength: 3,
      Body: {
        transformToByteArray: () => Promise.resolve(new Uint8Array([1, 2, 3])),
      },
    }),
  };
  const routes = createCoverImageRoutes({
    prisma: prisma as never,
    s3: s3 as never,
    bucketName: 'private-bucket',
    enabled: false,
    allowedOrigin: 'http://localhost:5173',
    digest: (value) => value,
  });
  return { prisma, s3, app: express().use(routes.router) };
}
const path = '/api/sites/7fced42f-e2e4-4c31-89db-f282bdaeea44/cover-image';
it('serves finalized private bytes to a Viewer with Site Access even if new uploads are disabled', async () => {
  const h = harness();
  const response = await request(h.app)
    .get(path)
    .set('Cookie', 'hansel_access=token')
    .expect(200);
  expect(response.headers['content-type']).toContain('image/png');
  expect(response.headers['cache-control']).toBe('private, no-store');
  expect(response.headers['x-content-type-options']).toBe('nosniff');
  expect(h.prisma.site.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 'tenant',
        OR: expect.any(Array),
      }),
    }),
  );
  expect(h.prisma.siteCoverImage.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 'tenant',
        completedAt: { not: null },
      }),
    }),
  );
});
it('rejects missing sessions and invisible or missing covers without touching storage', async () => {
  const h = harness();
  await request(h.app).get(path).expect(401);
  h.prisma.site.findFirst.mockResolvedValueOnce(null);
  await request(h.app)
    .get(path)
    .set('Cookie', 'hansel_access=token')
    .expect(404);
  h.prisma.siteCoverImage.findFirst.mockResolvedValueOnce(null);
  await request(h.app)
    .get(path)
    .set('Cookie', 'hansel_access=token')
    .expect(404);
  expect(h.s3.send).not.toHaveBeenCalled();
});
it('isolates unavailable storage with a generic private error', async () => {
  const h = harness();
  h.s3.send.mockRejectedValueOnce(new Error('private-storage-detail'));
  const response = await request(h.app)
    .get(path)
    .set('Cookie', 'hansel_access=token')
    .expect(503);
  expect(response.body).toEqual({ error: 'cover_image_unavailable' });
  expect(response.headers['cache-control']).toContain('no-store');
});

it('rejects invalid Site ids, missing objects, oversized bytes and missing storage without exposing details', async () => {
  const h = harness();
  const get = (app = h.app, url = path) =>
    request(app).get(url).set('Cookie', 'hansel_access=token');
  await get(
    h.app,
    path.replace('7fced42f-e2e4-4c31-89db-f282bdaeea44', 'invalid'),
  ).expect(404);
  for (const object of [
    {},
    { ContentLength: 0 },
    { ContentLength: 3_000_001, Body: {} },
    {
      ContentLength: 3,
      Body: {
        transformToByteArray: () => Promise.resolve(new Uint8Array(3_000_001)),
      },
    },
  ]) {
    h.s3.send.mockResolvedValueOnce(object);
    await get().expect(503);
  }
  h.prisma.siteCoverImage.findFirst.mockResolvedValueOnce({
    objectKey: 'private-key',
    mediaType: 'application/pdf',
  });
  await get().expect(503);
  h.s3.send.mockRejectedValueOnce(
    Object.assign(new Error('missing'), { name: 'NoSuchKey' }),
  );
  await get().expect(404);
  h.s3.send.mockRejectedValueOnce('unavailable');
  await get().expect(503);
  const recordEvent = vi.fn();
  const routes = createCoverImageRoutes({
    prisma: h.prisma as never,
    bucketName: null,
    enabled: false,
    allowedOrigin: 'http://localhost:5173',
    digest: (value) => value,
    recordEvent,
  });
  await get(express().use(routes.router)).expect(503);
  expect(recordEvent).toHaveBeenCalledWith('cover_image_read_failed');
});
