import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { registerSignCommentRoutes } from './sign-comment-routes.js';
import { registerSignDocumentRoutes } from './sign-document-routes.js';
import { registerSignPhotoRoutes } from './sign-photo-routes.js';
import {
  SignageConflictError,
  SignageForbiddenError,
  SignageNotFoundError,
} from './signage-schedule.js';
import { SignCommentValidationError } from './sign-comments.js';
import { SignDocumentRejectedError } from './sign-documents.js';
import { SignPhotoRejectedError } from './sign-photos.js';
const id = '00000000-0000-4000-8000-000000000001',
  origin = 'http://localhost:5173';
const input = {
  idempotencyKey: id,
  filename: 'file.png',
  mediaType: 'image/png',
  byteSize: 8,
  checksumSha256: 'a'.repeat(43) + '=',
};
for (const kind of ['comments', 'documents', 'photos'] as const)
  describe(`${kind} route dispatch [sign-comments/sign-documents/sign-photos REQ-004..012]`, () => {
    function setup(enabled = true) {
      const feature = {
        list: vi.fn().mockResolvedValue({}),
        people: vi.fn().mockResolvedValue({}),
        submit: vi.fn().mockResolvedValue({}),
        react: vi.fn().mockResolvedValue({}),
        initiate: vi.fn().mockResolvedValue({ id }),
        complete: vi.fn().mockResolvedValue({ id }),
        discard: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
        download: vi.fn().mockResolvedValue({
          filename: 'file.png',
          mediaType: 'image/png',
          bytes: new Uint8Array([1]),
        }),
        thumbnail: vi.fn().mockResolvedValue({ bytes: new Uint8Array([1]) }),
        cleanup: vi.fn(),
      };
      const resolve = vi.fn().mockResolvedValue({
          email: 'owner@example.com',
          userId: id,
          tenantId: id,
          membershipId: id,
          roleId: 'owner',
        }),
        record = vi.fn();
      const app = express().use(express.json());
      const options = {
        enabled,
        allowedOrigin: origin,
        resolve,
        record,
        feature,
        attachments: feature,
      };
      if (kind === 'comments') registerSignCommentRoutes(app, options);
      else if (kind === 'documents') registerSignDocumentRoutes(app, options);
      else registerSignPhotoRoutes(app, options);
      const base = `/api/sites/${id}/signs/${id}/${kind}`;
      const call = (
        method: 'get' | 'post' | 'put' | 'delete' | 'patch',
        suffix = '',
        body: object = {},
      ) =>
        request(app)
          [method](base + suffix)
          .set('Cookie', 'other=value; hansel_access=test')
          .set('Origin', origin)
          .send(body);
      return { app, base, feature, resolve, record, call };
    }
    it('dispatches all operations and rejects unsupported methods and malformed identifiers', async () => {
      const s = setup();
      await s.call('get').expect(200);
      await s
        .call(
          'get',
          `?cursor=${kind === 'comments' ? encodeURIComponent(JSON.stringify({ id, createdAt: '2026-09-01T00:00:00Z' })) : id}`,
        )
        .expect(200);
      await s.call('get', '?cursor=bad').expect(400);
      await request(s.app).get(s.base.replace(id, 'bad')).expect(400);
      await request(s.app)
        .get(s.base.replace('/signs/' + id, '/signs/bad'))
        .expect(400);
      await s.call('patch').expect(405);
      await s
        .call(
          'post',
          '',
          kind === 'comments'
            ? {
                idempotencyKey: id,
                body: 'Hello',
                parentId: null,
                mentions: [],
                attachmentIds: [],
              }
            : input,
        )
        .expect(200);
      await s.call('post', '', {}).expect(400);
      if (kind === 'comments') {
        await s.call('get', '/people').expect(200);
        await s.call('get', '/people?q=A&cursor=' + id).expect(200);
        await s
          .call('put', '/' + id + '/reactions', { emoji: '👍', selected: true })
          .expect(200);
        await s.call('get', '/' + id + '/reactions').expect(405);
        await s.call('post', '/attachments', input).expect(200);
        await s.call('post', '/attachments/' + id).expect(200);
        await s.call('delete', '/attachments/' + id).expect(200);
        await s.call('get', '/attachments/' + id + '/download').expect(200);
        await s.call('get', '/attachments/' + id + '/thumbnail').expect(200);
        await s.call('post', '/attachments/' + id + '/download').expect(405);
        await s.call('delete', '/attachments/' + id + '/thumbnail').expect(405);
        await s.call('get', '/attachments/' + id).expect(405);
        await s.call('get', '?parentId=' + id).expect(200);
      } else {
        await s.call('post', '/' + id).expect(200);
        await s.call('get', '/' + id + '/download').expect(200);
        await s.call('get', '/bad/download').expect(400);
        await s.call('get', '/' + id).expect(405);
        await s.call('post', '/' + id + '/download').expect(405);
        if (kind === 'photos') {
          await s.call('get', '/' + id + '/thumbnail').expect(200);
          await s.call('post', '/' + id + '/thumbnail').expect(405);
          await s.call('delete', '/' + id).expect(200);
        }
      }
    });
    it('fails closed on disabled capability, absent/expired session and categorical service errors', async () => {
      const s = setup();
      await request(setup(false).app).get(s.base).expect(404);
      await request(s.app).get(s.base).set('Cookie', 'other=value').expect(401);
      s.resolve.mockResolvedValueOnce(null);
      await s.call('get').expect(401);
      for (const [error, status] of [
        [new SignageForbiddenError(), 403],
        [new SignageNotFoundError(), 404],
        [new SignageConflictError(), 409],
        [
          kind === 'comments'
            ? new SignCommentValidationError('invalid_attachment')
            : kind === 'documents'
              ? new SignDocumentRejectedError()
              : new SignPhotoRejectedError(),
          422,
        ],
        [new Error('offline'), 503],
      ] as const) {
        s.feature.list.mockRejectedValueOnce(error);
        await s.call('get').expect(status);
      }
      expect(s.record).toHaveBeenCalledWith(expect.stringContaining('failure'));
    });
  });
