/** @spec sign-comments REQ-004..012 */
import type { Express } from 'express';
import { z } from 'zod';
import {
  commentCursorSchema,
  commentAttachmentUploadSchema,
  signCommentCreateSchema,
} from '@hansel/contracts';
import {
  SignCommentValidationError,
  type createSignCommentsFeature,
} from './sign-comments.js';
import type { createSignCommentAttachments } from './sign-comment-attachments.js';
import type { ApplicationPrincipal } from './sites.js';
import {
  SignageConflictError,
  SignageForbiddenError,
  SignageNotFoundError,
} from './signage-schedule.js';
export function registerSignCommentRoutes(
  app: Express,
  options: {
    enabled: boolean;
    allowedOrigin: string;
    resolve: (credential: string) => Promise<ApplicationPrincipal | null>;
    record: (name: string) => void;
    feature: ReturnType<typeof createSignCommentsFeature>;
    attachments: ReturnType<typeof createSignCommentAttachments>;
  },
) {
  const base = '/api/sites/:siteId/signs/:signId/comments';
  app.all(
    [
      base,
      `${base}/people`,
      `${base}/:commentId/reactions`,
      `${base}/attachments`,
      `${base}/attachments/:attachmentId`,
      `${base}/attachments/:attachmentId/download`,
      `${base}/attachments/:attachmentId/thumbnail`,
    ],
    async (req, res) => {
      res.set({
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      if (!options.enabled) return res.status(404).json({ error: 'not_found' });
      if (req.method !== 'GET' && req.headers.origin !== options.allowedOrigin)
        return res.status(403).json({ error: 'invalid_origin' });
      try {
        const siteId = z.uuid().parse(req.params.siteId),
          signId = z.uuid().parse(req.params.signId);
        const attachmentId = z.uuid().optional().parse(req.params.attachmentId);
        const commentId = z.uuid().optional().parse(req.params.commentId);
        const cookie = req.headers.cookie
          ?.split(';')
          .map((part) => part.trim())
          .find((part) => part.startsWith('hansel_access='))
          ?.slice(14);
        const p = cookie ? await options.resolve(cookie) : null;
        if (!p)
          return res.status(401).json({ error: 'authentication_required' });
        let result: unknown;
        if (attachmentId) {
          if (req.method === 'GET' && req.path.endsWith('/download')) {
            const file = await options.attachments.download(
              p,
              siteId,
              signId,
              attachmentId,
            );
            options.record('sign_comment_download_success');
            return res
              .attachment(file.filename)
              .type(file.mediaType)
              .send(Buffer.from(file.bytes));
          }
          if (req.method === 'GET' && req.path.endsWith('/thumbnail')) {
            const file = await options.attachments.thumbnail(
              p,
              siteId,
              signId,
              attachmentId,
            );
            return res.type('image/png').send(Buffer.from(file.bytes));
          }
          if (
            !req.path.endsWith('/download') &&
            !req.path.endsWith('/thumbnail') &&
            req.method === 'POST'
          )
            result = await options.attachments.complete(
              p,
              siteId,
              signId,
              attachmentId,
            );
          else if (
            !req.path.endsWith('/download') &&
            !req.path.endsWith('/thumbnail') &&
            req.method === 'DELETE'
          ) {
            await options.attachments.discard(p, siteId, signId, attachmentId);
            result = { discarded: true };
          } else return res.status(405).json({ error: 'method_not_allowed' });
        } else if (req.path.endsWith('/attachments') && req.method === 'POST')
          result = await options.attachments.initiate(
            p,
            siteId,
            signId,
            commentAttachmentUploadSchema.parse(req.body),
          );
        else if (req.path.endsWith('/people') && req.method === 'GET')
          result = await options.feature.people(
            p,
            siteId,
            signId,
            z
              .string()
              .max(200)
              .parse(req.query.q ?? ''),
            z.uuid().optional().parse(req.query.cursor),
          );
        else if (commentId && req.method === 'PUT')
          result = await options.feature.react(
            p,
            siteId,
            signId,
            commentId,
            req.body,
          );
        else if (req.path.endsWith('/comments') && req.method === 'GET') {
          const cursor = req.query.cursor
            ? commentCursorSchema.parse(
                JSON.parse(z.string().max(200).parse(req.query.cursor)),
              )
            : undefined;
          result = await options.feature.list(
            p,
            siteId,
            signId,
            z
              .uuid()
              .nullable()
              .parse(req.query.parentId ?? null),
            cursor,
          );
        } else if (req.path.endsWith('/comments') && req.method === 'POST')
          result = await options.feature.submit(
            p,
            siteId,
            signId,
            signCommentCreateSchema.parse(req.body),
          );
        else return res.status(405).json({ error: 'method_not_allowed' });
        options.record('sign_comment_request_success');
        return res.json(result);
      } catch (error) {
        options.record('sign_comment_request_failure');
        const status =
          error instanceof z.ZodError || error instanceof SyntaxError
            ? 400
            : error instanceof SignageForbiddenError
              ? 403
              : error instanceof SignageNotFoundError
                ? 404
                : error instanceof SignageConflictError
                  ? 409
                  : error instanceof SignCommentValidationError
                    ? 422
                    : 503;
        return res
          .status(status)
          .json({
            error:
              error instanceof SignCommentValidationError
                ? error.message
                : 'comment_request_failed',
          });
      }
    },
  );
}
