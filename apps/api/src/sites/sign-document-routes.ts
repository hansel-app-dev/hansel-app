/** @spec sign-documents REQ-006,008 */
import type { Express } from 'express';
import { z } from 'zod';
import { signDocumentUploadSchema } from '@hansel/contracts';
import {
  SignDocumentRejectedError,
  type createSignDocumentsFeature,
} from './sign-documents.js';
import {
  SignageConflictError,
  SignageForbiddenError,
  SignageNotFoundError,
} from './signage-schedule.js';
import type { ApplicationPrincipal } from './sites.js';

export function registerSignDocumentRoutes(
  app: Express,
  options: {
    enabled: boolean;
    allowedOrigin: string;
    resolve: (credential: string) => Promise<ApplicationPrincipal | null>;
    feature: ReturnType<typeof createSignDocumentsFeature>;
    record: (name: string) => void;
  },
) {
  app.all(
    [
      '/api/sites/:siteId/signs/:signId/documents',
      '/api/sites/:siteId/signs/:signId/documents/:documentId',
      '/api/sites/:siteId/signs/:signId/documents/:documentId/download',
    ],
    async (req, res) => {
      res.set({
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      if (!options.enabled) return res.status(404).json({ error: 'not_found' });
      const site = z.uuid().safeParse(req.params.siteId);
      const sign = z.uuid().safeParse(req.params.signId);
      const id = z.uuid().safeParse(req.params.documentId);
      const cursor = z.uuid().optional().safeParse(req.query.cursor);
      if (
        !site.success ||
        !sign.success ||
        !cursor.success ||
        (req.params.documentId && !id.success)
      )
        return res.status(400).json({ error: 'invalid_request' });
      if (req.method !== 'GET' && req.headers.origin !== options.allowedOrigin)
        return res.status(403).json({ error: 'invalid_origin' });
      const credential = req.headers.cookie
        ?.split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith('hansel_access='))
        ?.slice('hansel_access='.length);
      try {
        const p = credential ? await options.resolve(credential) : null;
        if (!p)
          return res.status(401).json({ error: 'authentication_required' });
        let result: unknown;
        if (req.method === 'GET' && !req.params.documentId)
          result = await options.feature.list(
            p,
            site.data,
            sign.data,
            cursor.data,
          );
        else if (
          req.method === 'GET' &&
          id.success &&
          req.path.endsWith('/download')
        ) {
          const file = await options.feature.download(
            p,
            site.data,
            sign.data,
            id.data,
          );
          options.record('sign_document_download_success');
          res.attachment(file.filename).type(file.mediaType);
          return res.send(Buffer.from(file.bytes));
        } else if (req.method === 'POST' && !req.params.documentId) {
          const input = signDocumentUploadSchema.safeParse(req.body);
          if (!input.success)
            return res.status(400).json({ error: 'invalid_upload' });
          result = await options.feature.initiate(
            p,
            site.data,
            sign.data,
            input.data,
          );
        } else if (
          req.method === 'POST' &&
          id.success &&
          !req.path.endsWith('/download')
        )
          result = await options.feature.complete(
            p,
            site.data,
            sign.data,
            id.data,
          );
        else return res.status(405).json({ error: 'method_not_allowed' });
        options.record('sign_document_request_success');
        return res.json(result);
      } catch (error) {
        options.record('sign_document_request_failure');
        const status =
          error instanceof SignageForbiddenError
            ? 403
            : error instanceof SignageNotFoundError
              ? 404
              : error instanceof SignageConflictError
                ? 409
                : error instanceof SignDocumentRejectedError
                  ? 422
                  : 503;
        return res.status(status).json({ error: 'document_request_failed' });
      }
    },
  );
}
