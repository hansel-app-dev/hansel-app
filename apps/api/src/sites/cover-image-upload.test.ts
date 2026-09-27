import express from 'express';
import request from 'supertest';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import { createCoverImageRoutes } from './cover-image.js';
const id = '00000000-0000-4000-8000-000000000001',
  origin = 'http://localhost:5173',
  base = `/api/sites/${id}/cover-image-uploads`;
async function setup(enabled = true, bucketName: string | null = 'bucket') {
  const bytes = await sharp({
    create: { width: 1, height: 1, channels: 3, background: '#fff' },
  })
    .png()
    .toBuffer();
  const input = {
    idempotencyKey: id,
    filename: 'cover.png',
    mediaType: 'image/png',
    byteSize: bytes.length,
    checksum: createHash('sha256').update(bytes).digest('hex'),
  };
  const row = {
    ...input,
    id,
    siteId: id,
    sessionFamilyId: id,
    completedAt: null as Date | null,
    expiresAt: new Date(Date.now() + 900000),
    objectKey: 'covers/' + id,
  };
  const credential = {
    kind: 'ACCESS',
    consumedAt: null as Date | null,
    expiresAt: new Date(Date.now() + 900000),
    family: {
      id,
      userId: id,
      tenantId: id,
      revokedAt: null as Date | null,
      absoluteExpiresAt: new Date(Date.now() + 900000),
    },
  };
  const prisma = {
    applicationSessionCredential: {
      findUnique: vi.fn().mockResolvedValue(credential),
    },
    membership: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id, tenantId: id, roleId: 'owner' }),
    },
    site: { findFirst: vi.fn().mockResolvedValue({ id }) },
    siteCoverImage: {
      findFirst: vi.fn().mockResolvedValue(row),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    coverImageDeletion: {
      findMany: vi.fn().mockResolvedValue([{ objectKey: 'old' }]),
      delete: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $transaction: vi
      .fn()
      .mockImplementation((work: (tx: unknown) => Promise<unknown>) =>
        Promise.resolve(work(prisma)),
      ),
  };
  const s3 = { send: vi.fn().mockResolvedValue({}) },
    record = vi.fn();
  const routes = createCoverImageRoutes({
    prisma: prisma as never,
    s3: s3 as never,
    bucketName,
    enabled,
    allowedOrigin: origin,
    digest: (value) => value,
    recordEvent: record,
  });
  const app = express().use(express.json()).use(routes.router);
  const start = (body: object = input) =>
    request(app)
      .post(base)
      .set('Origin', origin)
      .set('Cookie', 'other=test; hansel_access=test')
      .send(body);
  const finalize = (data = bytes) =>
    request(app)
      .post(base + '/' + id + '/finalize')
      .set('Origin', origin)
      .set('Cookie', 'hansel_access=test')
      .set('content-type', 'image/png')
      .send(data);
  return {
    app,
    bytes,
    input,
    row,
    credential,
    prisma,
    s3,
    routes,
    start,
    finalize,
  };
}
it('site-cover-image-add REQ-008..014,018: starts payload-bound intents with session and creator authorization', async () => {
  const s = await setup();
  await s.start().expect(201);
  expect(s.prisma.siteCoverImage.create).toHaveBeenCalledOnce();
  s.prisma.siteCoverImage.findUnique.mockResolvedValue(s.row);
  await s.start().expect(200);
  for (const override of [
    { sessionFamilyId: 'other' },
    { idempotencyKey: 'other' },
    { checksum: 'different' },
    { filename: 'different.png' },
    { byteSize: 1 },
    { mediaType: 'image/jpeg' },
    { expiresAt: new Date(0) },
  ]) {
    s.prisma.siteCoverImage.findUnique.mockResolvedValueOnce({
      ...s.row,
      ...override,
    });
    await s.start().expect(409);
  }
  s.prisma.siteCoverImage.findUnique.mockResolvedValueOnce({
    ...s.row,
    completedAt: new Date(),
    expiresAt: new Date(0),
  });
  await s.start().expect(200);
  s.prisma.site.findFirst.mockResolvedValueOnce(null);
  await s.start().expect(404);
  s.prisma.site.findFirst.mockRejectedValueOnce(new Error('offline'));
  await s.start().expect(503);
  await s.start({}).expect(400);
  await request(s.app)
    .post(base.replace(id, 'bad'))
    .set('Origin', origin)
    .send(s.input)
    .expect(400);
  await request(s.app)
    .post(base)
    .set('Origin', origin)
    .send(s.input)
    .expect(401);
  s.prisma.membership.findUnique.mockResolvedValueOnce(null);
  await s.start().expect(401);
  for (const override of [
    { kind: 'REFRESH' },
    { consumedAt: new Date() },
    { expiresAt: new Date(0) },
    { family: { ...s.credential.family, revokedAt: new Date() } },
    { family: { ...s.credential.family, absoluteExpiresAt: new Date(0) } },
  ]) {
    s.prisma.applicationSessionCredential.findUnique.mockResolvedValueOnce({
      ...s.credential,
      ...override,
    });
    await s.start().expect(401);
  }
  await (await setup(false)).start().expect(404);
  await (await setup(true, null)).start().expect(503);
  await request(s.app)
    .post(base)
    .set('Origin', 'https://other.test')
    .send(s.input)
    .expect(403);
  await request(s.app)
    .post(base)
    .set('sec-fetch-site', 'same-origin')
    .set('Cookie', 'hansel_access=test')
    .send(s.input)
    .expect(200);
});
it('site-cover-image-add REQ-011..014: verifies private bytes and serializes promotion, retry and expiry races', async () => {
  const s = await setup();
  s.prisma.siteCoverImage.findUnique.mockResolvedValue(s.row);
  await s.finalize().expect(200);
  expect(s.s3.send).toHaveBeenCalledOnce();
  expect(s.prisma.siteCoverImage.update).toHaveBeenCalledOnce();
  s.row.completedAt = new Date();
  await s.finalize().expect(200);
  expect(s.s3.send).toHaveBeenCalledOnce();
  s.row.completedAt = null;
  s.row.expiresAt = new Date(0);
  await s.finalize().expect(409);
  s.row.expiresAt = new Date(Date.now() + 900000);
  s.prisma.siteCoverImage.findFirst.mockResolvedValueOnce(null);
  await s.finalize().expect(404);
  for (const override of [
    { byteSize: 1 },
    { mediaType: 'image/jpeg' },
    { checksum: 'other' },
  ]) {
    s.prisma.siteCoverImage.findFirst.mockResolvedValueOnce({
      ...s.row,
      ...override,
    });
    await s.finalize().expect(400);
  }
  const bad = Buffer.from('invalid');
  s.prisma.siteCoverImage.findFirst.mockResolvedValueOnce({
    ...s.row,
    byteSize: bad.length,
    checksum: createHash('sha256').update(bad).digest('hex'),
  });
  await s.finalize(bad).expect(400);
  s.prisma.siteCoverImage.findUnique.mockResolvedValueOnce(null);
  await s.finalize().expect(503);
  s.prisma.siteCoverImage.findUnique.mockResolvedValueOnce({
    ...s.row,
    expiresAt: new Date(0),
  });
  await s.finalize().expect(503);
  s.prisma.siteCoverImage.findUnique.mockResolvedValueOnce({
    ...s.row,
    completedAt: new Date(),
  });
  await s.finalize().expect(200);
  await request(s.app)
    .post(base + '/' + id + '/finalize')
    .set('Origin', origin)
    .set('content-type', 'image/png')
    .send(s.bytes)
    .expect(401);
  await request(s.app)
    .post(base + '/' + id + '/finalize')
    .set('Origin', origin)
    .send({})
    .expect(400);
  await request(s.app)
    .post(base + '/bad/finalize')
    .set('Origin', origin)
    .set('content-type', 'image/png')
    .send(s.bytes)
    .expect(400);
  await request(s.app)
    .post(base.replace(id, 'bad') + '/' + id + '/finalize')
    .set('Origin', origin)
    .set('content-type', 'image/png')
    .send(s.bytes)
    .expect(400);
  await s.routes.cleanup();
  expect(s.prisma.coverImageDeletion.delete).toHaveBeenCalledWith({
    where: { objectKey: 'old' },
  });
});
