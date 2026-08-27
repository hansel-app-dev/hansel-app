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
  planSelectionPageResponseSchema,
  planSelectionRequestSchema,
  planSelectionResponseSchema,
  organizationProfilePageResponseSchema,
  organizationProfileRequestSchema,
  organizationProfileResponseSchema,
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
  type PlanSelectionPageResponse,
  type PlanSelectionRequest,
  type PlanSelectionResponse,
  type OrganizationProfilePageResponse,
  type OrganizationProfileRequest,
  type OrganizationProfileResponse,
} from '@hansel/contracts';
import { VerificationFailedError } from './onboarding/verify-email.js';
import { PersonalProfileTransitionError } from './onboarding/personal-profile.js';
import { PlanSelectionTransitionError } from './onboarding/plan-selection.js';
import {
  OrganizationProfileConflictError,
  OrganizationProfileTransitionError,
} from './onboarding/organization-profile.js';
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
  ): Promise<
    PersonalProfileResponse & {
      onboardingCredential: string;
      csrfProof: string;
    }
  >;
  load?(credential: string): Promise<PlanSelectionPageResponse>;
  select?(
    credential: string,
    csrfProof: string,
    input: PlanSelectionRequest,
  ): Promise<
    PlanSelectionResponse & {
      onboardingCredential: string;
      csrfProof: string;
    }
  >;
  loadOrganizationProfile?(
    credential: string,
  ): Promise<OrganizationProfilePageResponse>;
  submitOrganizationProfile?(
    credential: string,
    csrfProof: string,
    input: OrganizationProfileRequest,
  ): Promise<
    OrganizationProfileResponse & {
      onboardingCredential: string;
      csrfProof: string;
    }
  >;
  recordOrganizationProfileEvent?(name: string): void;
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

function renderPlanSelection(
  state: PlanSelectionPageResponse,
  interval: 'monthly' | 'annual',
  error = '',
  attemptedPriceId: string | null = null,
): string {
  const visible = state.plans.filter(
    (plan) => plan.planId === 'enterprise' || plan.billingInterval === interval,
  );
  const cards = visible
    .map((plan) => {
      const monthlyAmount = Number(plan.monthlyEquivalentMinor);
      const additionalSiteAmount = Number(plan.additionalSiteAmountMinor);
      const price = plan.contactSales
        ? '<strong>Custom</strong><span>Contact us for pricing</span>'
        : `<strong>$${(monthlyAmount / 100).toFixed(monthlyAmount % 100 ? 2 : 0)}/mo</strong><span>+$${String(additionalSiteAmount / 100)} for additional site</span>`;
      const action = plan.contactSales
        ? 'Schedule a call'
        : `Choose ${plan.displayName}`;
      return `<article class="plan"${attemptedPriceId === plan.priceId ? ' aria-current="true"' : ''}><h2>${escapeHtml(plan.displayName)}</h2><p>${escapeHtml(plan.description)}</p><ul>${plan.features.map((feature) => `<li>✓ ${escapeHtml(feature)}</li>`).join('')}</ul><div class="price">${price}</div><form action="/api/onboarding/plan-selection" method="post"><input type="hidden" name="priceId" value="${plan.priceId}"><button type="submit">${action}</button></form></article>`;
    })
    .join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Choose your plan — Hansel</title><link rel="stylesheet" href="/assets/plan-selection-progressive.css"></head><body><main><a href="/" aria-label="Hansel home"><img class="logo" src="/assets/hansel-logo-beta.svg" alt=""></a><section aria-labelledby="plan-heading"><h1 id="plan-heading">Welcome ${escapeHtml(state.firstName)}, choose your plan</h1>${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}<nav aria-label="Billing interval"><a href="?interval=monthly" aria-current="${interval === 'monthly' ? 'page' : 'false'}">Monthly</a><a href="?interval=annual" aria-current="${interval === 'annual' ? 'page' : 'false'}">Annual</a><span>Save 35%</span></nav><div class="plans">${cards}</div><form class="free" action="/api/onboarding/plan-selection" method="post"><input type="hidden" name="priceId" value="free"><button type="submit">Or try it for free</button></form></section><a class="back" href="/onboarding/about-you">Back</a></main></body></html>`;
}

function renderOrganizationProfile(
  state: OrganizationProfilePageResponse,
  values: Record<string, unknown> = {},
  error = '',
): string {
  const places = Object.entries(state.placesByIndustry).flatMap(
    ([industry, options]) => options.map((option) => ({ ...option, industry })),
  );
  const optionList = (
    options: readonly { id: string; label: string }[],
    selected: unknown,
  ) => renderOptions(options, selected);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Now your organization — Hansel</title><link rel="stylesheet" href="/assets/organization-profile-progressive.css"></head><body><main><a href="/" aria-label="Hansel home"><img class="logo" src="/assets/hansel-logo-beta.svg" alt=""></a><section aria-labelledby="organization-heading"><h1 id="organization-heading">Now your organization</h1><p class="required">All fields are required.</p>${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}<form action="/api/onboarding/organization-profile" method="post"><input type="hidden" name="submissionKey" value="${escapeHtml(state.submissionKey)}"><label for="organizationName">Organization</label><input id="organizationName" name="organizationName" required maxlength="200" value="${escapeHtml(values.organizationName)}"><label for="country">Country</label><select id="country" name="country" required>${optionList(state.countries, values.country)}</select><label for="industry">Industry or sector</label><select id="industry" name="industry" required>${optionList(state.industries, values.industry)}</select><label for="placeService">Type of place or service</label><select id="placeService" name="placeService" required><option value="">Select</option>${places.map(({ id, label, industry }) => `<option value="${id}" data-industry="${industry}"${values.placeService === id ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select><label for="organizationSize">Size</label><select id="organizationSize" name="organizationSize" required>${optionList(state.sizes, values.organizationSize)}</select><button type="submit">Next</button></form></section></main></body></html>`;
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

function hasAllowedFormOrigin(
  request: express.Request,
  allowedOrigin: string,
): boolean {
  if (request.headers.origin === allowedOrigin) return true;
  if (request.headers.origin !== 'null') return false;
  return (
    request.header('sec-fetch-site') === 'same-origin' &&
    request.header('host') === new URL(allowedOrigin).host
  );
}

export function createApp(
  config: Pick<AppConfig, 'allowedOrigin'> & {
    planSelectionEnabled?: boolean;
    organizationProfileEnabled?: boolean;
  },
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
    const planOnboarding = onboarding as OnboardingModule &
      Required<Pick<OnboardingModule, 'load' | 'select'>>;
    const organizationOnboarding = onboarding as OnboardingModule &
      Required<
        Pick<
          OnboardingModule,
          'loadOrganizationProfile' | 'submitOrganizationProfile'
        >
      >;
    const recordOrganizationEvent = (name: string) => {
      onboarding.recordOrganizationProfileEvent?.(name);
    };
    const readOnboardingCredential = (request: express.Request) =>
      readCookie(request.headers.cookie, onboardingCookieName);
    app.get('/api/onboarding/plan-selection', async (request, response) => {
      if (config.planSelectionEnabled === false) {
        response.status(404).json({ error: 'not_found' });
        return;
      }
      response.set('Cache-Control', 'private, no-store');
      const credential = readOnboardingCredential(request);
      if (!credential) {
        response.status(401).json({ error: 'onboarding_transition_failed' });
        return;
      }
      try {
        response.json(
          planSelectionPageResponseSchema.parse(
            await planOnboarding.load(credential),
          ),
        );
      } catch (error) {
        if (error instanceof PlanSelectionTransitionError) {
          response.status(409).json({ error: 'onboarding_transition_failed' });
          return;
        }
        throw error;
      }
    });
    app.get('/onboarding/plan-selection', async (request, response) => {
      if (config.planSelectionEnabled === false) {
        response.status(404).type('html').send('Not found.');
        return;
      }
      response.set('Cache-Control', 'private, no-store');
      const credential = readOnboardingCredential(request);
      if (!credential) {
        response
          .status(401)
          .type('html')
          .send('Onboarding session unavailable.');
        return;
      }
      try {
        const state = await planOnboarding.load(credential);
        const interval =
          request.query.interval === 'monthly' ? 'monthly' : 'annual';
        response.type('html').send(renderPlanSelection(state, interval));
      } catch (error) {
        if (error instanceof PlanSelectionTransitionError) {
          response
            .status(409)
            .type('html')
            .send('Onboarding session unavailable.');
          return;
        }
        throw error;
      }
    });
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
            path: '/',
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
        const { onboardingCredential, csrfProof, ...result } =
          await onboarding.submitPersonalProfile(
            credential,
            csrfCookie,
            input.data,
          );
        response.cookie(onboardingCookieName, onboardingCredential, {
          httpOnly: true,
          sameSite: 'lax',
          secure: config.allowedOrigin.startsWith('https://'),
          maxAge: 15 * 60 * 1000,
          path: '/',
        });
        response.cookie(onboardingCsrfCookieName, csrfProof, {
          httpOnly: false,
          sameSite: 'strict',
          secure: config.allowedOrigin.startsWith('https://'),
          maxAge: 15 * 60 * 1000,
          path: '/',
        });
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
    app.post('/api/onboarding/plan-selection', async (request, response) => {
      if (config.planSelectionEnabled === false) {
        response.status(404).json({ error: 'not_found' });
        return;
      }
      const isHtmlForm = request.is('application/x-www-form-urlencoded');
      const input = planSelectionRequestSchema.safeParse(request.body);
      const credential = readOnboardingCredential(request);
      const csrfCookie = readCookie(
        request.headers.cookie,
        onboardingCsrfCookieName,
      );
      const csrfHeader = request.header('x-hansel-csrf');
      const reject = async (status: number, error: string) => {
        if (isHtmlForm && credential) {
          try {
            const state = await planOnboarding.load(credential);
            const selected = input.success
              ? state.plans.find((plan) => plan.priceId === input.data.priceId)
              : null;
            response
              .status(status)
              .type('html')
              .send(
                renderPlanSelection(
                  state,
                  selected?.billingInterval ?? state.selectedInterval,
                  'We could not save your plan. Please try again.',
                  input.success ? input.data.priceId : null,
                ),
              );
            return;
          } catch (loadError) {
            if (!(loadError instanceof PlanSelectionTransitionError))
              throw loadError;
          }
        }
        if (isHtmlForm)
          response
            .status(status)
            .type('html')
            .send('We could not save your plan. Please try again.');
        else response.status(status).json({ error });
      };
      if (!input.success) {
        await reject(400, 'invalid_request');
        return;
      }
      if (
        (isHtmlForm
          ? !hasAllowedFormOrigin(request, config.allowedOrigin)
          : request.headers.origin !== config.allowedOrigin) ||
        !credential ||
        !csrfCookie ||
        (!isHtmlForm && csrfHeader !== csrfCookie)
      ) {
        await reject(401, 'onboarding_transition_failed');
        return;
      }
      try {
        const { onboardingCredential, csrfProof, ...result } =
          await planOnboarding.select(credential, csrfCookie, input.data);
        response.cookie(onboardingCookieName, onboardingCredential, {
          httpOnly: true,
          sameSite: 'lax',
          secure: config.allowedOrigin.startsWith('https://'),
          maxAge: 15 * 60 * 1000,
          path: '/',
        });
        response.cookie(onboardingCsrfCookieName, csrfProof, {
          httpOnly: false,
          sameSite: 'strict',
          secure: config.allowedOrigin.startsWith('https://'),
          maxAge: 15 * 60 * 1000,
          path: '/',
        });
        const output = planSelectionResponseSchema.parse(result);
        if (isHtmlForm) {
          const destination =
            output.nextStep === 'contact-sales'
              ? output.destination
              : `/onboarding/${output.nextStep}`;
          response.redirect(303, destination);
        } else response.json(output);
      } catch (error) {
        if (error instanceof PlanSelectionTransitionError) {
          await reject(409, 'onboarding_transition_failed');
          return;
        }
        throw error;
      }
    });
    app.get(
      '/api/onboarding/organization-profile',
      async (request, response) => {
        if (config.organizationProfileEnabled === false) {
          response.status(404).json({ error: 'not_found' });
          return;
        }
        response.set('Cache-Control', 'private, no-store');
        const credential = readOnboardingCredential(request);
        if (!credential) {
          recordOrganizationEvent('organization_profile_transition_rejected');
          response.status(401).json({ error: 'onboarding_transition_failed' });
          return;
        }
        try {
          response.json(
            organizationProfilePageResponseSchema.parse(
              await organizationOnboarding.loadOrganizationProfile(credential),
            ),
          );
        } catch (error) {
          if (error instanceof OrganizationProfileTransitionError) {
            response
              .status(409)
              .json({ error: 'onboarding_transition_failed' });
            return;
          }
          recordOrganizationEvent('organization_profile_unexpected_failure');
          throw error;
        }
      },
    );
    app.get('/onboarding/organization-profile', async (request, response) => {
      if (config.organizationProfileEnabled === false) {
        response.status(404).type('html').send('Not found.');
        return;
      }
      response.set('Cache-Control', 'private, no-store');
      const credential = readOnboardingCredential(request);
      if (!credential) {
        recordOrganizationEvent('organization_profile_transition_rejected');
        response
          .status(401)
          .type('html')
          .send('Onboarding session unavailable.');
        return;
      }
      try {
        response
          .type('html')
          .send(
            renderOrganizationProfile(
              await organizationOnboarding.loadOrganizationProfile(credential),
            ),
          );
      } catch (error) {
        if (error instanceof OrganizationProfileTransitionError) {
          response
            .status(409)
            .type('html')
            .send('Onboarding session unavailable.');
          return;
        }
        recordOrganizationEvent('organization_profile_unexpected_failure');
        throw error;
      }
    });
    app.post(
      '/api/onboarding/organization-profile',
      async (request, response) => {
        if (config.organizationProfileEnabled === false) {
          response.status(404).json({ error: 'not_found' });
          return;
        }
        const isHtmlForm = request.is('application/x-www-form-urlencoded');
        const input = organizationProfileRequestSchema.safeParse(request.body);
        const credential = readOnboardingCredential(request);
        const csrfCookie = readCookie(
          request.headers.cookie,
          onboardingCsrfCookieName,
        );
        const reject = async (status: number, error: string) => {
          if (isHtmlForm && credential) {
            try {
              const state =
                await organizationOnboarding.loadOrganizationProfile(
                  credential,
                );
              response
                .status(status)
                .type('html')
                .send(
                  renderOrganizationProfile(
                    state,
                    request.body as Record<string, unknown>,
                    'We could not save your organization. Review the form and try again.',
                  ),
                );
              return;
            } catch (loadError) {
              if (!(loadError instanceof OrganizationProfileTransitionError))
                throw loadError;
            }
          }
          if (isHtmlForm)
            response
              .status(status)
              .type('html')
              .send('We could not save your organization.');
          else response.status(status).json({ error });
        };
        if (!input.success) {
          recordOrganizationEvent('organization_profile_validation_rejected');
          await reject(400, 'invalid_request');
          return;
        }
        if (
          (isHtmlForm
            ? !hasAllowedFormOrigin(request, config.allowedOrigin)
            : request.headers.origin !== config.allowedOrigin) ||
          !credential ||
          !csrfCookie ||
          (!isHtmlForm && request.header('x-hansel-csrf') !== csrfCookie)
        ) {
          recordOrganizationEvent('organization_profile_transition_rejected');
          await reject(401, 'onboarding_transition_failed');
          return;
        }
        try {
          const { onboardingCredential, csrfProof, ...result } =
            await organizationOnboarding.submitOrganizationProfile(
              credential,
              csrfCookie,
              input.data,
            );
          response.cookie(onboardingCookieName, onboardingCredential, {
            httpOnly: true,
            sameSite: 'lax',
            secure: config.allowedOrigin.startsWith('https://'),
            maxAge: 15 * 60 * 1000,
            path: '/',
          });
          response.cookie(onboardingCsrfCookieName, csrfProof, {
            httpOnly: false,
            sameSite: 'strict',
            secure: config.allowedOrigin.startsWith('https://'),
            maxAge: 15 * 60 * 1000,
            path: '/',
          });
          const output = organizationProfileResponseSchema.parse(result);
          if (isHtmlForm) response.redirect(303, '/onboarding/discovery');
          else response.json(output);
        } catch (error) {
          if (error instanceof OrganizationProfileConflictError) {
            await reject(409, 'organization_profile_conflict');
            return;
          }
          if (error instanceof OrganizationProfileTransitionError) {
            await reject(409, 'onboarding_transition_failed');
            return;
          }
          recordOrganizationEvent('organization_profile_unexpected_failure');
          throw error;
        }
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
    const correlationId = randomUUID();
    console.error({ correlationId, errorType: typeof error });
    response.status(500).json({ error: 'internal_error', correlationId });
  };
  app.use(errorHandler);
  return app;
}
