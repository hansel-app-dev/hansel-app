import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SignDocumentUpload } from '@hansel/contracts';
import { createSignDocumentsFeature } from './sign-documents.js';
import { createSignPhotosFeature } from './sign-photos.js';
import { createSignCommentAttachments } from './sign-comment-attachments.js';
import { createPlanCommentAttachments } from './plan-comment-attachments.js';
import { createSignPhotoThumbnail } from './sign-photo-image.js';

vi.mock('./sign-photo-image.js', () => ({
  createSignPhotoThumbnail: vi.fn().mockResolvedValue(Buffer.from([1])),
}));
const id = '00000000-0000-4000-8000-000000000001';
const p = {
  email: 'owner@example.com',
  tenantId: id,
  userId: id,
  membershipId: id,
  roleId: 'owner',
};
const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const input: SignDocumentUpload = {
  idempotencyKey: id,
  filename: 'file.png',
  mediaType: 'image/png',
  byteSize: bytes.length,
  checksumSha256: createHash('sha256').update(bytes).digest('base64'),
};
const known = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('database race', {
    code,
    clientVersion: 'test',
  });
afterEach(() =>
  vi
    .mocked(createSignPhotoThumbnail)
    .mockReset()
    .mockResolvedValue(Buffer.from([1])),
);

for (const kind of [
  'document',
  'photo',
  'sign-comment',
  'plan-comment',
] as const) {
  const comment = kind.includes('comment');
  const modelName =
    kind === 'document'
      ? 'signDocument'
      : kind === 'photo'
        ? 'signPhoto'
        : kind === 'sign-comment'
          ? 'signCommentAttachment'
          : 'allocationPlanCommentAttachment';
  function setup() {
    let row = {
      id,
      ...input,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 900_000),
      completed: false,
      uploadedById: id,
      commentId: null as string | null,
      digest: '',
    };
    const model = {
      count: vi.fn().mockResolvedValue(1),
      findFirst: vi.fn().mockImplementation(() => Promise.resolve(row)),
      findUnique: vi.fn().mockImplementation(() => Promise.resolve(row)),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi
        .fn()
        .mockImplementation(({ data }: { data: typeof row }) =>
          Promise.resolve((row = { ...row, ...data })),
        ),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn(),
    };
    const ledger = {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    };
    const db = {
      [modelName]: model,
      [modelName + 'Object']: ledger,
      sign: { count: vi.fn().mockResolvedValue(1) },
      membership: {
        findFirst: vi.fn().mockResolvedValue({
          id,
          roleId: 'owner',
          user: { personalProfile: null },
        }),
      },
      site: { findFirst: vi.fn().mockResolvedValue({ id }) },
      allocationPlan: {
        findFirst: vi.fn().mockResolvedValue({ objectKey: 'legacy' }),
      },
      $queryRaw: vi.fn(),
      $transaction: vi
        .fn()
        .mockImplementation((work: (tx: unknown) => Promise<unknown>) =>
          Promise.resolve(work(db)),
        ),
    };
    const objects = {
      signPut: vi.fn().mockResolvedValue('https://uploads.example/file'),
      read: vi.fn().mockResolvedValue(bytes),
      promote: vi.fn(),
      remove: vi.fn(),
      write: vi.fn(),
    };
    const args = [p, id, id] as const;
    const planArgs = [p, id, id, null] as const;
    const f =
      kind === 'document'
        ? createSignDocumentsFeature(db as never, objects as never)
        : kind === 'photo'
          ? createSignPhotosFeature(db as never, objects as never)
          : kind === 'sign-comment'
            ? createSignCommentAttachments(db as never, objects as never)
            : createPlanCommentAttachments(db as never, objects as never);
    // Normalize the four public service signatures without mocking their implementation.
    const service =
      kind === 'plan-comment'
        ? createPlanCommentAttachments(db as never, objects as never)
        : null;
    const signService =
      kind === 'sign-comment'
        ? createSignCommentAttachments(db as never, objects as never)
        : null;
    const doc =
      kind === 'document'
        ? createSignDocumentsFeature(db as never, objects as never)
        : null;
    const photo =
      kind === 'photo'
        ? createSignPhotosFeature(db as never, objects as never)
        : null;
    const api = {
      initiate: (raw = input) =>
        service
          ? service.initiate(...planArgs, raw)
          : signService
            ? signService.initiate(...args, raw)
            : doc
              ? doc.initiate(...args, raw)
              : required(photo).initiate(...args, {
                  ...raw,
                  mediaType: 'image/png',
                }),
      complete: () =>
        service
          ? service.complete(...planArgs, row.id)
          : signService
            ? signService.complete(...args, row.id)
            : doc
              ? doc.complete(...args, row.id)
              : required(photo).complete(...args, row.id),
      download: () =>
        service
          ? service.download(...planArgs, row.id)
          : signService
            ? signService.download(...args, row.id)
            : doc
              ? doc.download(...args, row.id)
              : required(photo).download(...args, row.id),
      thumbnail: () =>
        service
          ? service.thumbnail(...planArgs, row.id)
          : signService
            ? signService.thumbnail(...args, row.id)
            : required(photo).thumbnail(...args, row.id),
      discard: () =>
        service
          ? service.discard(...planArgs, row.id)
          : signService
            ? signService.discard(...args, row.id)
            : required(photo).remove(...args, row.id),
      list: (cursor?: string) =>
        doc ? doc.list(...args, cursor) : required(photo).list(...args, cursor),
      cleanup: () => f.cleanup(),
    };
    return {
      model,
      ledger,
      db,
      objects,
      api,
      get row() {
        return row;
      },
    };
  }
  describe(`${kind} upload lifecycle [sign-documents/sign-photos/sign-comments/allocation-plan-comments REQ-004..012]`, () => {
    it('binds intents to their payload, replays completions and rejects changed or expired intents', async () => {
      const s = setup();
      s.model.findUnique.mockResolvedValueOnce(null);
      const intent = await s.api.initiate();
      expect(intent).toMatchObject({
        completed: false,
        uploadUrl: 'https://uploads.example/file',
      });
      expect(s.ledger.create).toHaveBeenCalledOnce();
      await expect(s.api.initiate()).resolves.toEqual(intent);
      await expect(
        s.api.initiate({ ...input, filename: 'other.png' }),
      ).rejects.toThrow();
      s.row.completed = true;
      await expect(s.api.initiate()).resolves.toEqual({
        id: s.row.id,
        completed: true,
      });
      await expect(s.api.complete()).resolves.toMatchObject({ id: s.row.id });
      s.row.completed = false;
      s.row.expiresAt = new Date(0);
      await expect(s.api.initiate()).rejects.toThrow();
      await expect(s.api.complete()).rejects.toThrow();
    });
    it('recovers a duplicate insert race but propagates other failures', async () => {
      const s = setup();
      s.model.findUnique.mockResolvedValueOnce(null);
      await s.api.initiate();
      for (const error of [new Error('offline'), known('P2000')]) {
        s.model.findUnique.mockResolvedValueOnce(null);
        s.db.$transaction.mockRejectedValueOnce(error);
        await expect(s.api.initiate()).rejects.toBe(error);
      }
      s.model.findUnique.mockResolvedValueOnce(null);
      s.db.$transaction.mockRejectedValueOnce(known('P2002'));
      await expect(s.api.initiate()).resolves.toMatchObject({ id: s.row.id });
      s.model.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      s.db.$transaction.mockRejectedValueOnce(known('P2002'));
      await expect(s.api.initiate()).rejects.toThrow();
    });
    it('validates bytes and checksum before promotion and checks completion races', async () => {
      const s = setup();
      s.model.findUnique.mockResolvedValueOnce(null);
      await s.api.initiate();
      await expect(s.api.complete()).resolves.toMatchObject({
        filename: 'file.png',
      });
      expect(s.objects.promote).toHaveBeenCalledOnce();
      for (const bad of [
        Buffer.from([1]),
        Buffer.alloc(bytes.length),
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 11]),
      ]) {
        s.objects.read.mockResolvedValueOnce(bad);
        await expect(s.api.complete()).rejects.toThrow();
      }
      if (kind !== 'document') {
        vi.mocked(createSignPhotoThumbnail).mockRejectedValueOnce(
          new Error('decode'),
        );
        await expect(s.api.complete()).rejects.toThrow();
      }
      s.model.updateMany.mockResolvedValueOnce({ count: 0 });
      await expect(s.api.complete()).rejects.toThrow();
      s.model.findFirst.mockResolvedValueOnce(null);
      await expect(s.api.complete()).rejects.toThrow();
    });
    it('serves only completed verified downloads and image thumbnails', async () => {
      const s = setup();
      await expect(s.api.download()).rejects.toThrow();
      if (kind !== 'document')
        await expect(s.api.thumbnail()).rejects.toThrow();
      s.row.completed = true;
      await expect(s.api.download()).resolves.toMatchObject({
        bytes,
        filename: 'file.png',
      });
      for (const bad of [Buffer.from([1]), Buffer.alloc(bytes.length)]) {
        s.objects.read.mockResolvedValueOnce(bad);
        await expect(s.api.download()).rejects.toThrow();
      }
      if (kind !== 'document')
        await expect(s.api.thumbnail()).resolves.toHaveProperty('bytes');
      if (comment) {
        s.row.mediaType = 'application/pdf';
        await expect(s.api.thumbnail()).rejects.toThrow();
        s.row.uploadedById = 'other';
        await expect(s.api.download()).rejects.toThrow();
        s.row.commentId = id;
        await expect(s.api.download()).resolves.toMatchObject({ bytes });
        await expect(s.api.complete()).rejects.toThrow();
      }
    });
    it('reclaims expired objects and retains durable ledgers for published content', async () => {
      const s = setup();
      const key =
        kind === 'document'
          ? 'documentId'
          : kind === 'photo'
            ? 'photoId'
            : 'attachmentId';
      s.ledger.findMany.mockResolvedValue([{ [key]: id }]);
      if (comment) s.row.commentId = id;
      else s.row.completed = true;
      await s.api.cleanup();
      expect(s.objects.remove).toHaveBeenCalledTimes(1);
      if (comment) {
        s.row.commentId = null;
        await s.api.cleanup(); // An unexpired draft remains protected.
        s.row.expiresAt = new Date(0);
        await s.api.cleanup(); // Concurrent publication wins after expiry deletion.
        s.model.findUnique
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null);
      } else s.model.findUnique.mockResolvedValueOnce(null);
      await s.api.cleanup();
      expect(s.ledger.deleteMany).toHaveBeenCalledOnce();
      expect(s.objects.remove).toHaveBeenCalledWith(
        expect.stringContaining(id),
      );
    });
    if (comment) {
      it('permits only the draft owner to discard and allows PDF completion without a thumbnail', async () => {
        const s = setup();
        await s.api.discard();
        expect(s.model.deleteMany).toHaveBeenCalledOnce();
        s.model.findFirst.mockResolvedValueOnce(null);
        await s.api.discard();
        s.row.uploadedById = 'other';
        await expect(s.api.discard()).rejects.toThrow();
        s.row.commentId = id;
        await expect(s.api.discard()).rejects.toThrow();
        s.row.uploadedById = id;
        s.row.commentId = null;
        const pdf = Buffer.from('%PDF-1.7\n');
        s.row.mediaType = 'application/pdf';
        s.row.byteSize = pdf.length;
        s.row.checksumSha256 = createHash('sha256')
          .update(pdf)
          .digest('base64');
        s.objects.read.mockResolvedValue(pdf);
        await s.api.complete();
        expect(s.objects.write).not.toHaveBeenCalled();
      });
    } else {
      it('paginates completed media and requires Sign management for writes', async () => {
        const s = setup();
        expect(await s.api.list()).toHaveProperty('nextCursor', null);
        s.model.findMany.mockResolvedValue(
          Array.from({ length: 51 }, () => s.row),
        );
        const page = await s.api.list(id);
        expect(page.nextCursor).toBe(id);
        expect(s.model.findMany).toHaveBeenLastCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ completed: true, id: { gt: id } }),
          }),
        );
        s.db.sign.count.mockResolvedValueOnce(0);
        await expect(s.api.list()).rejects.toThrow();
        if (kind === 'photo') {
          await s.api.discard();
          expect(s.model.deleteMany).toHaveBeenCalledOnce();
        }
        const f =
          kind === 'document'
            ? createSignDocumentsFeature(s.db as never, s.objects as never)
            : createSignPhotosFeature(s.db as never, s.objects as never);
        await expect(
          f.initiate({ ...p, roleId: 'viewer' }, id, id, {
            ...input,
            mediaType: 'image/png',
          }),
        ).rejects.toThrow();
        await f.list({ ...p, roleId: 'viewer' }, id, id);
      });
    }
  });
}

function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Expected fixture value');
  return value;
}
