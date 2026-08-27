import compression from 'compression';
import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { healthResponseSchema } from '@hansel/contracts';
import type { AppConfig } from './config.js';

type ConfigureRoutes = (app: express.Express) => void;

export function createApp(
  config: Pick<AppConfig, 'allowedOrigin'>,
  configureRoutes?: ConfigureRoutes,
) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.allowedOrigin }));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_request, response) => {
    response.json(healthResponseSchema.parse({ status: 'ok' }));
  });
  configureRoutes?.(app);

  app.use((_request, response) => {
    response.status(404).json({ error: 'not_found' });
  });

  const errorHandler: ErrorRequestHandler = (
    error,
    _request,
    response,
    _next,
  ) => {
    console.error(error);
    response.status(500).json({ error: 'internal_error' });
  };
  app.use(errorHandler);
  return app;
}
