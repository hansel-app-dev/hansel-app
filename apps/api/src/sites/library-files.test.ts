/** @spec library-files REQ-001..003,008,009 */
import { expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import {
  registerLibraryFile,
  createLibraryFilesFeature,
} from './library-files.js';
const p = {
  tenantId: '00000000-0000-4000-8000-000000000001',
  userId: '00000000-0000-4000-8000-000000000002',
  membershipId: '00000000-0000-4000-8000-000000000003',
  roleId: 'owner',
  email: 'owner@example.com',
};
it('library-files registers one immutable original and rejects unauthorized discovery', async () => {
  const file = {
    id: p.tenantId,
    tenantId: p.tenantId,
    sourceSiteId: p.tenantId,
    sourceKind: 'photo',
    sourceId: p.userId,
    filename: 'photo.png',
    mediaType: 'image/png',
    byteSize: 5,
    checksumSha256: 'checksum',
    uploadedById: p.userId,
    originalKey: 'photos/one',
    thumbnailKey: 'photos/one/thumb',
    createdAt: new Date(),
  };
  const db = {
    libraryFile: {
      upsert: vi.fn().mockResolvedValue(file),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    membership: { findFirst: vi.fn().mockResolvedValue(null) },
  };
  const client = db as unknown as PrismaClient;
  expect(await registerLibraryFile(client, file)).toBe(file);
  expect(db.libraryFile.upsert).toHaveBeenCalledWith(
    expect.objectContaining({ update: {} }),
  );
  const service = createLibraryFilesFeature(client, {} as never);
  await expect(service.list(p, { q: '', kind: 'all' })).rejects.toThrow();
  await expect(service.download(p, p.tenantId)).rejects.toThrow();
});

import { createHash } from 'node:crypto';
import sharp from 'sharp';
import {
  SignageConflictError,
  SignageForbiddenError,
  SignageNotFoundError,
} from './signage-schedule.js';
const id = p.tenantId,
  key = p.userId;
function fixture() {
  const bytes = Buffer.from('%PDF-file');
  const file = {
    id,
    tenantId: p.tenantId,
    sourceSiteId: id,
    sourceKind: 'document',
    sourceId: key,
    filename: 'floor.pdf',
    mediaType: 'application/pdf',
    byteSize: bytes.length,
    checksumSha256: createHash('sha256').update(bytes).digest('base64'),
    uploadedById: p.userId,
    originalKey: 'documents/file',
    thumbnailKey: null as string | null,
    createdAt: new Date('2026-09-27T00:00:00Z'),
    sourceSite: { id, name: 'Source' },
    uploadedBy: {
      email: p.email,
      personalProfile: { firstName: 'Owner', lastName: 'Member' },
    },
  };
  const attachment = {
    id: key,
    filename: file.filename,
    mediaType: file.mediaType,
    byteSize: bytes.length,
    createdAt: file.createdAt,
  };
  const plan = {
    id: key,
    name: 'Plan',
    filename: null,
    mediaType: null,
    byteSize: null,
    createdAt: file.createdAt,
    updatedAt: file.createdAt,
    files: [
      {
        id,
        filename: file.filename,
        mediaType: file.mediaType,
        byteSize: bytes.length,
      },
    ],
    uploadedBy: file.uploadedBy,
  };
  const db = {
    membership: { findFirst: vi.fn().mockResolvedValue({ roleId: 'owner' }) },
    site: { count: vi.fn().mockResolvedValue(1) },
    sign: { count: vi.fn().mockResolvedValue(1) },
    libraryFile: {
      findFirst: vi.fn().mockResolvedValue(file),
      findMany: vi.fn().mockResolvedValue([file]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      upsert: vi.fn().mockResolvedValue(file),
    },
    libraryRequest: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
    },
    signDocument: {
      upsert: vi.fn().mockResolvedValue(attachment),
      findMany: vi.fn().mockResolvedValue([attachment]),
    },
    signPhoto: {
      upsert: vi.fn().mockResolvedValue(attachment),
      findMany: vi.fn().mockResolvedValue([attachment]),
    },
    allocationPlan: {
      create: vi.fn().mockResolvedValue(plan),
      findFirst: vi.fn().mockResolvedValue(plan),
    },
    allocationPlanUploadBatch: {
      create: vi.fn().mockResolvedValue({ id: key }),
    },
    allocationPlanUpload: { create: vi.fn() },
    activity: { create: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  );
  const objects = {
    read: vi.fn().mockResolvedValue(bytes),
    write: vi.fn().mockResolvedValue(undefined),
    inspect: vi.fn(),
    signPut: vi.fn(),
    promote: vi.fn(),
    remove: vi.fn(),
  };
  const service = createLibraryFilesFeature(
    db as unknown as PrismaClient,
    objects,
    true,
  );
  return { file, bytes, objects, db, service, attachment, plan };
}
it('library-files filters/paginates privately and verifies downloads and thumbnails [REQ-003,004,012]', async () => {
  const { db, service, file, objects, bytes } = fixture();
  const first = await service.list(p, { q: 'floor', kind: 'all' });
  expect(first.files[0]?.uploadedBy).toBe('Owner Member');
  expect(first.nextCursor).toBeNull();
  expect(db.libraryFile.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        tenantId: p.tenantId,
        sourceSite: { tenantId: p.tenantId },
        filename: { contains: 'floor', mode: 'insensitive' },
      }),
    }),
  );
  file.uploadedBy.personalProfile = null as never;
  await service.list(p, { q: '', kind: 'image', cursor: id });
  await service.list(p, { q: '', kind: 'pdf' });
  db.libraryFile.findMany.mockResolvedValue(
    Array.from({ length: 51 }, () => file),
  );
  expect((await service.list(p, { q: '', kind: 'all' })).nextCursor).toBe(id);
  expect((await service.download(p, id)).bytes).toBe(bytes);
  await expect(service.thumbnail(p, id)).rejects.toBeInstanceOf(
    SignageNotFoundError,
  );
  file.thumbnailKey = 'thumb';
  expect((await service.thumbnail(p, id)).mediaType).toBe('image/png');
  for (const value of [
    Buffer.from('x'),
    Buffer.from('%PDF-wrong'),
    Buffer.from('not-a-pdf'),
  ]) {
    objects.read.mockResolvedValue(value);
    file.byteSize = value.length;
    file.checksumSha256 = createHash('sha256').update(value).digest('base64');
    if (value.toString() === '%PDF-wrong') file.checksumSha256 = 'wrong';
    await expect(service.download(p, id)).rejects.toBeInstanceOf(
      SignageNotFoundError,
    );
  }
  db.libraryFile.findFirst.mockResolvedValue(null);
  await expect(service.download(p, id)).rejects.toBeInstanceOf(
    SignageNotFoundError,
  );
});
it('library-files links independent Documents, replays results and rejects conflicts and permission changes [REQ-003,007,008]', async () => {
  const { service, db } = fixture(),
    input = { fileIds: [id], idempotencyKey: key };
  expect(
    (await service.link(p, id, key, 'documents', input)).items[0]?.id,
  ).toBe(key);
  expect(db.signDocument.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { signId_libraryFileId: { signId: key, libraryFileId: id } },
      create: expect.objectContaining({ libraryFileId: id, completed: true }),
    }),
  );
  const request = db.libraryRequest.create.mock.calls[0]?.[0] as {
    data: { digest: string; result: unknown };
  };
  db.libraryRequest.findUnique.mockResolvedValue({
    digest: request.data.digest,
    result: request.data.result,
  });
  await service.link(p, id, key, 'documents', input);
  expect(db.signDocument.upsert).toHaveBeenCalledTimes(1);
  await expect(
    service.link(p, id, key, 'documents', { ...input, fileIds: [key] }),
  ).rejects.toBeInstanceOf(SignageConflictError);
  db.libraryRequest.findUnique.mockResolvedValue(null);
  db.membership.findFirst.mockResolvedValue({ roleId: 'viewer' });
  await expect(
    service.link(p, id, key, 'documents', input),
  ).rejects.toBeInstanceOf(SignageForbiddenError);
  db.membership.findFirst.mockResolvedValue({ roleId: 'owner' });
  db.site.count.mockResolvedValue(0);
  await expect(
    service.link(p, id, key, 'documents', input),
  ).rejects.toBeInstanceOf(SignageNotFoundError);
  db.site.count.mockResolvedValue(1);
  db.sign.count.mockResolvedValue(0);
  await expect(
    service.link(p, id, key, 'documents', input),
  ).rejects.toBeInstanceOf(SignageNotFoundError);
});
it('library-files creates a safe thumbnail when reusing an image from Docs as Photos [REQ-005,008,012]', async () => {
  const { service, db, file, objects } = fixture(),
    input = { fileIds: [id], idempotencyKey: key };
  await expect(
    service.link(p, id, key, 'photos', input),
  ).rejects.toBeInstanceOf(SignageConflictError);
  const image = await sharp({
    create: { width: 2, height: 2, channels: 3, background: '#ffffff' },
  })
    .png()
    .toBuffer();
  file.mediaType = 'image/png';
  file.byteSize = image.length;
  file.checksumSha256 = createHash('sha256').update(image).digest('base64');
  objects.read.mockResolvedValue(image);
  db.signPhoto.upsert.mockResolvedValue({
    id: key,
    filename: 'image.png',
    mediaType: 'image/png',
    byteSize: image.length,
    createdAt: file.createdAt,
  });
  await service.link(p, id, key, 'photos', input);
  expect(objects.write).toHaveBeenCalledOnce();
  expect(db.libraryFile.updateMany).toHaveBeenCalled();
  file.thumbnailKey = 'thumb';
  await service.link(p, id, key, 'photos', { ...input, idempotencyKey: id });
  expect(objects.write).toHaveBeenCalledOnce();
  db.libraryFile.findFirst
    .mockResolvedValueOnce(file)
    .mockResolvedValueOnce({ ...file, mediaType: 'application/pdf' });
  await expect(
    service.link(p, id, key, 'photos', input),
  ).rejects.toBeInstanceOf(SignageConflictError);
});
it('library-files creates exactly one independent plan and replays it [REQ-006,008]', async () => {
  const { service, db, plan } = fixture(),
    input = { fileId: id, name: 'Plan', idempotencyKey: key };
  expect((await service.createPlan(p, id, input)).plan.id).toBe(plan.id);
  expect(db.allocationPlanUpload.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        libraryFileId: id,
        verifiedObjectKey: 'documents/file',
        groupedPlanId: plan.id,
        status: 'COMPLETED',
      }),
    }),
  );
  expect(db.activity.create).toHaveBeenCalledOnce();
  const request = db.libraryRequest.create.mock.calls[0]?.[0] as {
    data: { digest: string; result: unknown };
  };
  db.libraryRequest.findUnique.mockResolvedValue({
    digest: request.data.digest,
    result: request.data.result,
  });
  await service.createPlan(p, id, input);
  expect(db.allocationPlan.create).toHaveBeenCalledOnce();
  db.libraryRequest.findUnique.mockResolvedValue(null);
  db.allocationPlan.findFirst.mockResolvedValue(null);
  await expect(service.createPlan(p, id, input)).rejects.toBeInstanceOf(
    SignageNotFoundError,
  );
  db.libraryRequest.findUnique.mockResolvedValue(null);
  db.membership.findFirst.mockResolvedValue({ roleId: 'editor' });
  await expect(service.createPlan(p, id, input)).rejects.toBeInstanceOf(
    SignageForbiddenError,
  );
  db.membership.findFirst.mockResolvedValue({ roleId: 'owner' });
  db.allocationPlan.findFirst.mockResolvedValue(plan);
  db.activity.create.mockClear();
  await createLibraryFilesFeature(
    db as unknown as PrismaClient,
    {} as never,
  ).createPlan(p, id, { ...input, idempotencyKey: id });
  expect(db.activity.create).not.toHaveBeenCalled();
});
