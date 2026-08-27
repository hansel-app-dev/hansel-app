import compression from 'compression';
import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import {
  createOnboardingAccountRequestSchema,
  createOnboardingAccountResponseSchema,
  healthResponseSchema,
  resendOnboardingVerificationRequestSchema,
  resendOnboardingVerificationResponseSchema,
  verifyOnboardingEmailRequestSchema,
  verifyOnboardingEmailResponseSchema,
  type CreateOnboardingAccountRequest,
  type CreateOnboardingAccountResponse,
  type ResendOnboardingVerificationRequest,
  type ResendOnboardingVerificationResponse,
  type VerifyOnboardingEmailRequest,
  type VerifyOnboardingEmailResponse,
} from '@hansel/contracts';
import { VerificationFailedError } from './onboarding/verify-email.js';
import type { AppConfig } from './config.js';

type ConfigureRoutes = (app: express.Express) => void;

export interface OnboardingModule {
  createAccount(
    input: CreateOnboardingAccountRequest,
  ): Promise<CreateOnboardingAccountResponse>;
  verifyEmail(
    input: VerifyOnboardingEmailRequest,
  ): Promise<VerifyOnboardingEmailResponse>;
  resendVerification(
    input: ResendOnboardingVerificationRequest,
  ): Promise<ResendOnboardingVerificationResponse>;
}

export function createApp(
  config: Pick<AppConfig, 'allowedOrigin'>,
  configureRoutes?: ConfigureRoutes,
  onboarding?: OnboardingModule,
) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.allowedOrigin }));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_request, response) => {
    response.json(healthResponseSchema.parse({ status: 'ok' }));
  });
  if (onboarding) {
    app.post('/api/onboarding/accounts', async (request, response) => {
      const input = createOnboardingAccountRequestSchema.safeParse(
        request.body,
      );
      if (!input.success) {
        response.status(400).json({ error: 'invalid_request' });
        return;
      }

      const result = await onboarding.createAccount(input.data);
      response
        .status(202)
        .json(createOnboardingAccountResponseSchema.parse(result));
    });
    app.post(
      '/api/onboarding/email-verification/verify',
      async (request, response) => {
        const input = verifyOnboardingEmailRequestSchema.safeParse(
          request.body,
        );
        if (!input.success) {
          response.status(400).json({ error: 'invalid_request' });
          return;
        }
        try {
          const result = await onboarding.verifyEmail(input.data);
          response.json(verifyOnboardingEmailResponseSchema.parse(result));
        } catch (error) {
          if (error instanceof VerificationFailedError) {
            response.status(400).json({ error: 'verification_failed' });
            return;
          }
          throw error;
        }
      },
    );
    app.post(
      '/api/onboarding/email-verification/resend',
      async (request, response) => {
        const input = resendOnboardingVerificationRequestSchema.safeParse(
          request.body,
        );
        if (!input.success) {
          response.status(400).json({ error: 'invalid_request' });
          return;
        }
        const result = await onboarding.resendVerification(input.data);
        response
          .status(202)
          .json(resendOnboardingVerificationResponseSchema.parse(result));
      },
    );
  }
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
