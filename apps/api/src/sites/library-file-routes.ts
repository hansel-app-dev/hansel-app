/** @spec library-files REQ-003..008 */
import type { Express } from 'express';
import { z } from 'zod';
import {
  libraryQuerySchema,
  librarySelectionSchema,
  libraryPlanSchema,
} from '@hansel/contracts';
import {
  SignageConflictError,
  SignageForbiddenError,
  SignageNotFoundError,
} from './signage-schedule.js';
import type { ApplicationPrincipal } from './sites.js';
import type { createLibraryFilesFeature } from './library-files.js';
export function registerLibraryFileRoutes(
  app: Express,
  options: {
    enabled: boolean;
    allowedOrigin: string;
    resolve: (credential: string) => Promise<ApplicationPrincipal | null>;
    feature: ReturnType<typeof createLibraryFilesFeature>;
    record: (name: string) => void;
  },
) {
  app.all(
    [
      '/api/library-files',
      '/api/library-files/:fileId/download',
      '/api/library-files/:fileId/thumbnail',
      '/api/sites/:siteId/library-plans',
      '/api/sites/:siteId/signs/:signId/library-documents',
      '/api/sites/:siteId/signs/:signId/library-photos',
    ],
    async (req, res) => {
      res.set({
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      if (!options.enabled) return res.status(404).json({ error: 'not_found' });
      if (req.method !== 'GET' && req.headers.origin !== options.allowedOrigin)
        return res.status(403).json({ error: 'invalid_origin' });
      const ids = z
        .object({
          fileId: z.uuid().optional(),
          siteId: z.uuid().optional(),
          signId: z.uuid().optional(),
        })
        .safeParse(req.params);
      if (!ids.success)
        return res.status(400).json({ error: 'invalid_request' });
      const credential = req.headers.cookie
        ?.split(';')
        .map((v) => v.trim())
        .find((v) => v.startsWith('hansel_access='))
        ?.slice(14);
      try {
        const p = credential ? await options.resolve(credential) : null;
        if (!p)
          return res.status(401).json({ error: 'authentication_required' });
        const { fileId, siteId, signId } = ids.data;
        if (req.method === 'GET' && fileId) {
          if (req.path.endsWith('/download')) {
            const file = await options.feature.download(p, fileId);
            return res
              .attachment(file.filename)
              .type(file.mediaType)
              .send(Buffer.from(file.bytes));
          }
          const image = await options.feature.thumbnail(p, fileId);
          return res.type(image.mediaType).send(Buffer.from(image.bytes));
        }
        if (req.method === 'GET' && !siteId) {
          const query = libraryQuerySchema.safeParse(req.query);
          if (!query.success)
            return res.status(400).json({ error: 'invalid_request' });
          return res.json(await options.feature.list(p, query.data));
        }
        if (req.method === 'POST' && siteId) {
          if (signId) {
            const input = librarySelectionSchema.safeParse(req.body);
            if (!input.success)
              return res.status(400).json({ error: 'invalid_selection' });
            const result = await options.feature.link(
              p,
              siteId,
              signId,
              req.path.endsWith('library-photos') ? 'photos' : 'documents',
              input.data,
            );
            options.record('library_file_link_success');
            return res.json(result);
          }
          const input = libraryPlanSchema.safeParse(req.body);
          if (!input.success)
            return res.status(400).json({ error: 'invalid_selection' });
          const result = await options.feature.createPlan(
            p,
            siteId,
            input.data,
          );
          options.record('library_plan_create_success');
          return res.json(result);
        }
        return res.status(405).json({ error: 'method_not_allowed' });
      } catch (error) {
        options.record('library_file_request_failed');
        const status =
          error instanceof SignageForbiddenError
            ? 403
            : error instanceof SignageNotFoundError
              ? 404
              : error instanceof SignageConflictError
                ? 409
                : 503;
        return res
          .status(status)
          .json({ error: 'library_file_request_failed' });
      }
    },
  );
}
