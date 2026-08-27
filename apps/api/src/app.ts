import compression from 'compression';
import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import {
  createOnboardingAccountRequestSchema,
  createOnboardingAccountResponseSchema,
  healthResponseSchema,
  departmentOptions,
  jobTitleOptions,
  personalProfileRequestSchema,
  personalProfileResponseSchema,
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
  type PersonalProfileRequest,
  type PersonalProfileResponse,
} from '@hansel/contracts';
import { VerificationFailedError } from './onboarding/verify-email.js';
import { PersonalProfileTransitionError } from './onboarding/personal-profile.js';
import type { AppConfig } from './config.js';

type ConfigureRoutes = (app: express.Express) => void;

export interface OnboardingModule {
  createAccount(
    input: CreateOnboardingAccountRequest,
  ): Promise<CreateOnboardingAccountResponse>;
  verifyEmail(input: VerifyOnboardingEmailRequest): Promise<
    VerifyOnboardingEmailResponse & {
      onboardingCredential: string;
      csrfProof: string;
    }
  >;
  resendVerification(
    input: ResendOnboardingVerificationRequest,
  ): Promise<ResendOnboardingVerificationResponse>;
  submitPersonalProfile(
    credential: string,
    csrfProof: string,
    input: PersonalProfileRequest,
  ): Promise<PersonalProfileResponse>;
}

const onboardingCookieName = 'hansel_onboarding';
const onboardingCsrfCookieName = 'hansel_onboarding_csrf';

function escapeHtml(value: unknown): string {
  return typeof value === 'string'
    ? value.replace(/[&<>"']/g, (character) =>
        character === '&'
          ? '&amp;'
          : character === '<'
            ? '&lt;'
            : character === '>'
              ? '&gt;'
              : character === '"'
                ? '&quot;'
                : '&#39;',
      )
    : '';
}

function renderOptions(
  options: readonly { id: string; label: string }[],
  selected: unknown,
): string {
  return [
    '<option value="">Select</option>',
    ...options.map(
      ({ id, label }) =>
        `<option value="${id}"${selected === id ? ' selected' : ''}>${escapeHtml(label)}</option>`,
    ),
  ].join('');
}

function renderAboutYouForm(
  values: Record<string, unknown> = {},
  error = '',
): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tell us about you — Hansel</title><link rel="stylesheet" href="/assets/about-you-progressive.css"></head><body><main><a href="/" aria-label="Hansel home"><img class="logo" src="/assets/hansel-logo-beta.svg" alt=""></a><section class="panel" aria-labelledby="about-heading"><h1 id="about-heading">Tell us about you</h1><p class="required">All fields are required.</p>${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}<form action="/api/onboarding/personal-profile" method="post">
  <div class="field"><label for="firstName">First name</label><input id="firstName" name="firstName" autocomplete="given-name" required maxlength="100" value="${escapeHtml(values.firstName)}"></div>
  <div class="field"><label for="lastName">Last name</label><input id="lastName" name="lastName" autocomplete="family-name" required maxlength="100" value="${escapeHtml(values.lastName)}"></div>
  <div class="field job"><label for="jobTitle">Job title</label><select id="jobTitle" name="jobTitle" required>${renderOptions(jobTitleOptions, values.jobTitle)}</select><div class="field other"><label for="jobTitleOther">Other job title</label><input id="jobTitleOther" name="jobTitleOther" maxlength="100"${values.jobTitle === 'other' ? ' required' : ''} value="${escapeHtml(values.jobTitleOther)}"></div></div>
  <div class="field department"><label for="department">Department</label><select id="department" name="department" required>${renderOptions(departmentOptions, values.department)}</select><div class="field other"><label for="departmentOther">Other department</label><input id="departmentOther" name="departmentOther" maxlength="100"${values.department === 'other' ? ' required' : ''} value="${escapeHtml(values.departmentOther)}"></div></div>
  <button class="next" type="submit">Next</button></form></section></main></body></html>`;
}

function omitEmptyOtherFields(
  body: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(body).filter(
      ([key, value]) =>
        !['jobTitleOther', 'departmentOther'].includes(key) || value !== '',
    ),
  );
}

function readCookie(header: string | undefined, name: string): string | null {
  const value = header
    ?.split(';')
    .map((part) => part.trim().split('='))
    .find(([cookieName]) => cookieName === name)?.[1];
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
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
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  app.get('/api/health', (_request, response) => {
    response.json(healthResponseSchema.parse({ status: 'ok' }));
  });
  app.get('/onboarding/about-you', (_request, response) => {
    response.type('html').send(renderAboutYouForm());
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
          const { onboardingCredential, csrfProof, ...result } =
            await onboarding.verifyEmail(input.data);
          response.cookie(onboardingCookieName, onboardingCredential, {
            httpOnly: true,
            sameSite: 'lax',
            secure: config.allowedOrigin.startsWith('https://'),
            maxAge: 15 * 60 * 1000,
            path: '/api/onboarding',
          });
          response.cookie(onboardingCsrfCookieName, csrfProof, {
            httpOnly: false,
            sameSite: 'strict',
            secure: config.allowedOrigin.startsWith('https://'),
            maxAge: 15 * 60 * 1000,
            path: '/',
          });
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
    app.post('/api/onboarding/personal-profile', async (request, response) => {
      const isHtmlForm = request.is('application/x-www-form-urlencoded');
      const reject = (status: number, error: string) => {
        if (isHtmlForm) {
          response
            .status(status)
            .type('html')
            .send(
              renderAboutYouForm(
                request.body as Record<string, unknown>,
                'We could not save your details. Review the form and try again.',
              ),
            );
        } else response.status(status).json({ error });
      };
      const input = personalProfileRequestSchema.safeParse(
        isHtmlForm
          ? omitEmptyOtherFields(request.body as Record<string, unknown>)
          : request.body,
      );
      if (!input.success) {
        reject(400, 'invalid_request');
        return;
      }
      const credential = readCookie(
        request.headers.cookie,
        onboardingCookieName,
      );
      const csrfCookie = readCookie(
        request.headers.cookie,
        onboardingCsrfCookieName,
      );
      const csrfHeader = request.header('x-hansel-csrf');
      if (
        request.headers.origin !== config.allowedOrigin ||
        !credential ||
        !csrfCookie ||
        (!isHtmlForm && csrfHeader !== csrfCookie)
      ) {
        reject(401, 'onboarding_transition_failed');
        return;
      }
      try {
        const result = await onboarding.submitPersonalProfile(
          credential,
          csrfCookie,
          input.data,
        );
        const output = personalProfileResponseSchema.parse(result);
        if (isHtmlForm) response.redirect(303, '/onboarding/plan-selection');
        else response.json(output);
      } catch (error) {
        if (error instanceof PersonalProfileTransitionError) {
          reject(409, 'onboarding_transition_failed');
          return;
        }
        throw error;
      }
    });
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
    const correlationId = randomUUID();
    console.error({ correlationId, errorType: typeof error });
    response.status(500).json({ error: 'internal_error', correlationId });
  };
  app.use(errorHandler);
  return app;
}
