/** @spec allocation-plan-comments REQ-004..012 */
import type { Express } from 'express';
import { z } from 'zod';
import {
  commentCursorSchema,
  commentAttachmentUploadSchema,
  planCommentCreateSchema,
} from '@hansel/contracts';
import { SignCommentValidationError } from './sign-comments.js';
import type { createPlanCommentsFeature } from './plan-comments.js';
import type { createPlanCommentAttachments } from './plan-comment-attachments.js';
import type { ApplicationPrincipal } from './sites.js';
import {
  SignageConflictError,
  SignageForbiddenError,
  SignageNotFoundError,
} from './signage-schedule.js';
export function registerPlanCommentRoutes(
  app: Express,
  options: {
    enabled: boolean;
    allowedOrigin: string;
    resolve: (credential: string) => Promise<ApplicationPrincipal | null>;
    record: (name: string) => void;
    feature: ReturnType<typeof createPlanCommentsFeature>;
    attachments: ReturnType<typeof createPlanCommentAttachments>;
  },
) {
  const base =
    '/api/sites/:siteId/allocation-plans/:planId/files/:fileId/comments';
  app.all(
    [
      base,
      `${base}/people`,
      `${base}/attachments`,
      `${base}/attachments/:attachmentId`,
      `${base}/attachments/:attachmentId/download`,
      `${base}/attachments/:attachmentId/thumbnail`,
      `${base}/:threadId`,
      `${base}/:threadId/state`,
      `${base}/:threadId/position`,
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
          planId = z.uuid().parse(req.params.planId);
        const attachmentId = z.uuid().optional().parse(req.params.attachmentId);
        const threadId = z.uuid().optional().parse(req.params.threadId);
        const fileId =
          req.params.fileId === 'legacy'
            ? null
            : z.uuid().parse(req.params.fileId);
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
              planId,
              fileId,
              attachmentId,
            );
            options.record('plan_comment_download_success');
            return res
              .attachment(file.filename)
              .type(file.mediaType)
              .send(Buffer.from(file.bytes));
          }
          if (req.method === 'GET' && req.path.endsWith('/thumbnail')) {
            const file = await options.attachments.thumbnail(
              p,
              siteId,
              planId,
              fileId,
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
              planId,
              fileId,
              attachmentId,
            );
          else if (
            !req.path.endsWith('/download') &&
            !req.path.endsWith('/thumbnail') &&
            req.method === 'DELETE'
          ) {
            await options.attachments.discard(
              p,
              siteId,
              planId,
              fileId,
              attachmentId,
            );
            result = { discarded: true };
          } else return res.status(405).json({ error: 'method_not_allowed' });
        } else if (req.path.endsWith('/attachments') && req.method === 'POST')
          result = await options.attachments.initiate(
            p,
            siteId,
            planId,
            fileId,
            commentAttachmentUploadSchema.parse(req.body),
          );
        else if (req.path.endsWith('/people') && req.method === 'GET')
          result = await options.feature.people(
            p,
            siteId,
            planId,
            fileId,
            z
              .string()
              .max(200)
              .parse(req.query.q ?? ''),
            z.uuid().optional().parse(req.query.cursor),
          );
        else if (
          threadId &&
          req.method === 'PUT' &&
          req.path.endsWith('/position')
        )
          result = await options.feature.position(
            p,
            siteId,
            planId,
            fileId,
            threadId,
            req.body,
          );
        else if (
          threadId &&
          req.method === 'PUT' &&
          req.path.endsWith('/state')
        )
          result = await options.feature.state(
            p,
            siteId,
            planId,
            fileId,
            threadId,
            req.body,
          );
        else if (
          req.method === 'GET' &&
          !req.path.endsWith('/state') &&
          !req.path.endsWith('/position') &&
          (threadId || req.path.endsWith('/comments'))
        ) {
          const cursor = req.query.cursor
            ? commentCursorSchema.parse(
                JSON.parse(z.string().max(200).parse(req.query.cursor)),
              )
            : undefined;
          // Legacy visibility values are validated but no longer filter markers.
          if (!threadId)
            z.enum(['true', 'false']).optional().parse(req.query.resolved);
          result = threadId
            ? await options.feature.history(
                p,
                siteId,
                planId,
                fileId,
                threadId,
                cursor,
              )
            : await options.feature.markers(p, siteId, planId, fileId, cursor);
        } else if (!threadId && req.method === 'POST')
          result = await options.feature.submit(
            p,
            siteId,
            planId,
            fileId,
            planCommentCreateSchema.parse(req.body),
          );
        else return res.status(405).json({ error: 'method_not_allowed' });
        options.record('plan_comment_request_success');
        return res.json(result);
      } catch (error) {
        options.record('plan_comment_request_failure');
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
        return res.status(status).json({
          error:
            error instanceof SignCommentValidationError
              ? error.message
              : 'comment_request_failed',
        });
      }
    },
  );
}
