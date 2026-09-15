import compression from 'compression';
import { registerSignDocumentRoutes } from './sites/sign-document-routes.js';
import { registerSignPhotoRoutes } from './sites/sign-photo-routes.js';
import { registerSignCommentRoutes } from './sites/sign-comment-routes.js';
import {
  planSignCreateSchema,
  planSignPatchSchema,
  planSignDeleteSchema,
  planSignSchema,
  planSignsResponseSchema,
  type PlanSign,
  type PlanSignCreate,
  type PlanSignPatch,
  type PlanSignsResponse,
} from '@hansel/contracts';
import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import {
  createOnboardingAccountRequestSchema,
  createOnboardingAccountResponseSchema,
  discoveryPageResponseSchema,
  discoveryRequestSchema,
  discoveryResponseSchema,
  dashboardResponseSchema,
  loginRequestSchema,
  loginResponseSchema,
  passwordRecoveryRequestSchema,
  passwordRecoveryRequestResponseSchema,
  passwordResetRequestSchema,
  passwordResetResponseSchema,
  healthResponseSchema,
  departmentOptions,
  jobTitleOptions,
  personalProfileRequestSchema,
  personalProfilePageResponseSchema,
  personalProfileResponseSchema,
  planSelectionPageResponseSchema,
  planSelectionRequestSchema,
  planSelectionResponseSchema,
  organizationProfilePageResponseSchema,
  organizationProfileRequestSchema,
  organizationProfileResponseSchema,
  createSiteRequestSchema,
  legacyCreateSiteRequestSchema,
  createSiteResponseSchema,
  siteActivityResponseSchema,
  sitesPageResponseSchema,
  allocationPlansResponseSchema,
  commitAllocationPlanDraftRequestSchema,
  verifyAllocationPlanDraftResponseSchema,
  type CommitAllocationPlanDraftRequest,
  createAllocationPlanUploadBatchRequestSchema,
  createAllocationPlanUploadBatchResponseSchema,
  finalizeAllocationPlanUploadResponseSchema,
  signageScheduleResponseSchema,
  createSignTypeRequestSchema,
  updateSignTypeRequestSchema,
  createSignRequestSchema,
  updateSignRequestSchema,
  siteActivityPageResponseSchema,
  siteActivityItemSchema,
  createSiteCommentRequestSchema,
  resendOnboardingVerificationRequestSchema,
  resendOnboardingVerificationResponseSchema,
  verifyOnboardingEmailRequestSchema,
  verifyOnboardingEmailResponseSchema,
  type CreateOnboardingAccountRequest,
  type CreateOnboardingAccountResponse,
  type DiscoveryPageResponse,
  type DiscoveryRequest,
  type DiscoveryResponse,
  type DashboardResponse,
  type LoginRequest,
  type PasswordRecoveryRequest,
  type PasswordRecoveryRequestResponse,
  type PasswordResetRequest,
  type PasswordResetResponse,
  type ResendOnboardingVerificationRequest,
  type ResendOnboardingVerificationResponse,
  type VerifyOnboardingEmailRequest,
  type VerifyOnboardingEmailResponse,
  type PersonalProfileRequest,
  type PersonalProfilePageResponse,
  type PersonalProfileResponse,
  type PlanSelectionPageResponse,
  type PlanSelectionRequest,
  type PlanSelectionResponse,
  type OrganizationProfilePageResponse,
  type OrganizationProfileRequest,
  type OrganizationProfileResponse,
  type CreateSiteRequest,
  type CreateSiteResponse,
  type SiteActivityResponse,
  type SitesPageResponse,
  type AllocationPlansResponse,
  type CreateAllocationPlanUploadBatchRequest,
  type CreateAllocationPlanUploadBatchResponse,
  type FinalizeAllocationPlanUploadResponse,
  type SignageScheduleResponse,
  type SignType,
  type Sign,
  type SiteActivityItem,
  type SiteActivityPageResponse,
} from '@hansel/contracts';
import type { PasswordLoginResult } from './auth/password-login.js';
import { PasswordResetRejectedError } from './auth/password-recovery.js';
import type {
  ExternalLoginResult,
  ExternalProvider,
} from './auth/external-login.js';
import { externalProviders } from './auth/external-login.js';
import { VerificationFailedError } from './onboarding/verify-email.js';
import { PersonalProfileTransitionError } from './onboarding/personal-profile.js';
import { PlanSelectionTransitionError } from './onboarding/plan-selection.js';
import {
  OrganizationProfileConflictError,
  OrganizationProfileTransitionError,
} from './onboarding/organization-profile.js';
import {
  DiscoveryConflictError,
  DiscoveryTransitionError,
} from './onboarding/discovery.js';
import {
  SitesConflictError,
  SitesForbiddenError,
  SitesNotFoundError,
  SitesPaidSeatRequiredError,
  SitesUpgradeRequiredError,
} from './sites/sites.js';
import {
  AllocationPlanUploadRejectedError,
  AllocationPlansConflictError,
  AllocationPlansForbiddenError,
  AllocationPlansNotFoundError,
} from './sites/allocation-plans.js';
import {
  SignageConflictError,
  SignageForbiddenError,
  SignageNotFoundError,
} from './sites/signage-schedule.js';
import { SiteActivityNotFoundError } from './sites/site-activity.js';
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
  loadPersonalProfile?(
    credential: string,
  ): Promise<PersonalProfilePageResponse>;
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
  loadDiscovery?(credential: string): Promise<DiscoveryPageResponse>;
  completeDiscovery?(
    credential: string,
    csrfProof: string,
    input: DiscoveryRequest,
  ): Promise<
    DiscoveryResponse & {
      applicationSession?: {
        accessCredential: string;
        refreshCredential: string;
      };
    }
  >;
  recordDiscoveryEvent?(name: string): void;
}

export interface DashboardModule {
  load(input: {
    accessCredential: string | null;
    refreshCredential: string | null;
  }): Promise<
    | (DashboardResponse & {
        applicationSession?: {
          accessCredential: string;
          refreshCredential: string;
        };
      })
    | null
  >;
  logout(input: {
    accessCredential: string | null;
    refreshCredential: string | null;
  }): Promise<void>;
  recordEvent?(name: string): void;
}

export interface AuthenticationModule {
  login(input: LoginRequest): Promise<PasswordLoginResult>;
  requestPasswordRecovery?(
    input: PasswordRecoveryRequest,
  ): Promise<PasswordRecoveryRequestResponse>;
  resetPassword?(input: PasswordResetRequest): Promise<PasswordResetResponse>;
  startExternal?(provider: ExternalProvider, intent: 'login'): Promise<string>;
  callbackExternal?(
    provider: ExternalProvider,
    parameters: Record<string, string>,
  ): Promise<ExternalLoginResult>;
  recordEvent?(name: string): void;
}

export interface SitesModule {
  signPhotos?: Omit<Parameters<typeof registerSignPhotoRoutes>[1], 'enabled' | 'allowedOrigin'>;
  signComments?: Omit<Parameters<typeof registerSignCommentRoutes>[1], 'enabled' | 'allowedOrigin'>;
  signDocuments?: Omit<
    Parameters<typeof registerSignDocumentRoutes>[1],
    'enabled' | 'allowedOrigin'
  >;
  load(accessCredential: string): Promise<SitesPageResponse | null>;
  create(
    accessCredential: string,
    input: CreateSiteRequest,
  ): Promise<CreateSiteResponse | null>;
  activity(
    accessCredential: string,
    siteId: string,
  ): Promise<SiteActivityResponse | null>;
  listSiteActivity?(
    accessCredential: string,
    siteId: string,
    cursor?: string,
  ): Promise<SiteActivityPageResponse | null>;
  createSiteComment?(
    accessCredential: string,
    siteId: string,
    text: string,
  ): Promise<SiteActivityItem | null>;
  listAllocationPlans?(
    accessCredential: string,
    siteId: string,
  ): Promise<AllocationPlansResponse | null>;
  createAllocationPlanDraft?(
    credential: string,
    siteId: string,
    input: CreateAllocationPlanUploadBatchRequest,
  ): Promise<CreateAllocationPlanUploadBatchResponse | null>;
  verifyAllocationPlanDraft?(
    credential: string,
    siteId: string,
    uploadId: string,
  ): Promise<{ uploadId: string; verified: true } | null>;
  commitAllocationPlanDraft?(
    credential: string,
    siteId: string,
    input: CommitAllocationPlanDraftRequest,
  ): Promise<FinalizeAllocationPlanUploadResponse | null>;
  loadAllocationPlanContent?(
    accessCredential: string,
    siteId: string,
    planId: string,
    fileId?: string,
  ): Promise<{ mediaType: string; bytes: Uint8Array } | null>;
  loadSignageSchedule?(
    accessCredential: string,
    siteId: string,
  ): Promise<SignageScheduleResponse | null>;
  planSigns?: {
    load(
      credential: string,
      siteId: string,
      planId: string,
      fileId: string | null,
    ): Promise<PlanSignsResponse | null>;
    create(
      credential: string,
      siteId: string,
      planId: string,
      input: PlanSignCreate,
    ): Promise<PlanSign | null>;
    update(
      credential: string,
      siteId: string,
      planId: string,
      signId: string,
      input: PlanSignPatch,
    ): Promise<PlanSign | null>;
    remove(
      credential: string,
      siteId: string,
      planId: string,
      signId: string,
      updatedAt: string,
    ): Promise<boolean>;
  };
  createSignType?(
    accessCredential: string,
    siteId: string,
    name: string,
  ): Promise<SignType | null>;
  updateSignType?(
    accessCredential: string,
    siteId: string,
    id: string,
    name: string,
    expectedUpdatedAt: string,
  ): Promise<SignType | null>;
  createSign?(
    accessCredential: string,
    siteId: string,
    typeId: string,
    input: {
      code: string;
      quantity: number;
      location: string;
      content: string;
      comments: string;
      status: Sign['status'];
    },
  ): Promise<Sign | null>;
  updateSign?(
    accessCredential: string,
    siteId: string,
    id: string,
    input: { field: string; value: string | number; expectedUpdatedAt: string },
  ): Promise<Sign | null>;
  createAllocationPlanUploadBatch?(
    accessCredential: string,
    siteId: string,
    input: CreateAllocationPlanUploadBatchRequest,
  ): Promise<CreateAllocationPlanUploadBatchResponse | null>;
  finalizeAllocationPlanUpload?(
    accessCredential: string,
    siteId: string,
    uploadId: string,
  ): Promise<FinalizeAllocationPlanUploadResponse | null>;
  recordEvent?(name: string): void;
}

const onboardingCookieName = 'hansel_onboarding';
const onboardingCsrfCookieName = 'hansel_onboarding_csrf';
const applicationAccessCookieName = 'hansel_access';
const applicationRefreshCookieName = 'hansel_refresh';

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

function bodyString(
  body: Record<string, unknown>,
  field: string,
): string | undefined {
  const value = body[field];
  return typeof value === 'string' ? value : undefined;
}

function preventRecoveryResponseReuse(response: express.Response): void {
  response
    .set('Cache-Control', 'private, no-store')
    .vary('Origin')
    .vary('Cookie');
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

function renderLoginForm(
  values: Record<string, unknown> = {},
  error = '',
  status = '',
): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Log in — Hansel</title><link rel="stylesheet" href="/assets/login-progressive.css"></head><body><main><a class="logo" href="/" aria-label="Hansel home"><img src="/assets/hansel-logo-beta.svg" alt=""></a><section class="login-panel" aria-labelledby="login-heading"><h1 id="login-heading">Log in to your account</h1><div class="login-form-group">${status ? `<p role="status">${escapeHtml(status)}</p>` : ''}${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}<form action="/api/auth/login" method="post"><div class="auth-field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" placeholder="your@email.com" required value="${escapeHtml(values.email)}"></div><div class="auth-field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" placeholder="Password" required maxlength="128"></div><p><a href="/forgot-password">Forgot password?</a></p><button type="submit">Log in</button></form></div><div class="provider-group"><div class="divider" aria-hidden="true"><span>or log in with</span><img data-testid="login-provider-divider" src="/assets/login-provider-divider.svg" alt=""></div><nav aria-label="External login providers"><a href="/auth/start/google?intent=login"><span class="provider-icon"><img src="/assets/google-logo.svg" alt="" aria-hidden="true"></span>Continue with Google</a><a href="/auth/start/microsoft?intent=login"><span class="provider-icon"><img src="/assets/microsoft-logo.svg" alt="" aria-hidden="true"></span>Continue with Microsoft</a><a href="/auth/start/apple?intent=login"><span class="provider-icon"><img class="apple" src="/assets/apple-logo.svg" alt="" aria-hidden="true"></span>Continue with Apple</a></nav></div><p>Don&#39;t have an account? <a href="/onboarding">Create an account</a></p></section></main></body></html>`;
}

function renderForgotPasswordForm(
  values: Record<string, unknown> = {},
  error = '',
): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Forgot password — Hansel</title><link rel="stylesheet" href="/assets/login-progressive.css"></head><body><main><a class="logo" href="/" aria-label="Hansel home"><img src="/assets/hansel-logo-beta.svg" alt=""></a><section aria-labelledby="forgot-password-heading"><h1 id="forgot-password-heading">Forgot your password?</h1><p>Enter your email and we&#39;ll send you a code to reset your password.</p>${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}<form action="/api/auth/password-recovery/request" method="post"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" placeholder="your@email.com" required value="${escapeHtml(values.email)}"><button type="submit">Send reset code</button></form><p><a href="/login">Back to log in</a></p></section></main></body></html>`;
}

function renderResetPasswordForm(
  values: Record<string, unknown> = {},
  error = '',
  requested = false,
): string {
  const status = requested
    ? "If an eligible Hansel account exists for that email, we've sent a reset code. Check your inbox and spam folder."
    : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reset password — Hansel</title><link rel="stylesheet" href="/assets/login-progressive.css"></head><body><main><a class="logo" href="/" aria-label="Hansel home"><img src="/assets/hansel-logo-beta.svg" alt=""></a><section aria-labelledby="reset-password-heading"><h1 id="reset-password-heading">Reset your password</h1>${status ? `<p role="status">${escapeHtml(status)}</p>` : ''}${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}<form action="/api/auth/password-recovery/reset" method="post"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" placeholder="your@email.com" required value="${escapeHtml(values.email)}"><label for="code">Reset code</label><input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required><label for="password">New password</label><input id="password" name="password" type="password" autocomplete="new-password" maxlength="128" required><label for="confirmPassword">Confirm new password</label><input id="confirmPassword" name="confirmPassword" type="password" autocomplete="new-password" maxlength="128" required><button type="submit">Reset password</button></form><p><a href="/forgot-password">Request a new code</a></p><p><a href="/login">Back to log in</a></p></section></main></body></html>`;
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
  const formValues = Object.keys(values).length
    ? values
    : (state.profile ?? {});
  const places = Object.entries(state.placesByIndustry).flatMap(
    ([industry, options]) => options.map((option) => ({ ...option, industry })),
  );
  const optionList = (
    options: readonly { id: string; label: string }[],
    selected: unknown,
  ) => renderOptions(options, selected);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Now your organization — Hansel</title><link rel="stylesheet" href="/assets/organization-profile-progressive.css"></head><body><main><a href="/" aria-label="Hansel home"><img class="logo" src="/assets/hansel-logo-beta.svg" alt=""></a><section aria-labelledby="organization-heading"><h1 id="organization-heading">Now your organization</h1><p class="required">All fields are required.</p>${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}<form action="/api/onboarding/organization-profile" method="post"><input type="hidden" name="submissionKey" value="${escapeHtml(state.submissionKey)}"><label for="organizationName">Organization</label><input id="organizationName" name="organizationName" required maxlength="200" value="${escapeHtml(formValues.organizationName)}"><label for="country">Country</label><select id="country" name="country" required>${optionList(state.countries, formValues.country)}</select><label for="industry">Industry or sector</label><select id="industry" name="industry" required>${optionList(state.industries, formValues.industry)}</select><label for="placeService">Type of place or service</label><select id="placeService" name="placeService" required><option value="">Select</option>${places.map(({ id, label, industry }) => `<option value="${id}" data-industry="${industry}"${formValues.placeService === id ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select><label for="organizationSize">Size</label><select id="organizationSize" name="organizationSize" required>${optionList(state.sizes, formValues.organizationSize)}</select><button type="submit">Next</button></form></section></main></body></html>`;
}

function renderDiscovery(
  state: DiscoveryPageResponse,
  values: Record<string, unknown> = {},
  error = '',
): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Could you tell us more? — Hansel</title><link rel="stylesheet" href="/assets/discovery-progressive.css"></head><body><main><a href="/" aria-label="Hansel home"><img class="logo" src="/assets/hansel-logo-beta.svg" alt=""></a><section aria-labelledby="discovery-heading"><h1 id="discovery-heading">Could you tell us more?</h1>${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}<form action="/api/onboarding/discovery" method="post"><input type="hidden" name="submissionKey" value="${escapeHtml(state.submissionKey)}"><label for="currentManagement">How do you manage your signage currently?</label><select id="currentManagement" name="currentManagement" required>${renderOptions(state.methods, values.currentManagement)}</select><div class="other"><label for="currentManagementOther">Other tools</label><input id="currentManagementOther" name="currentManagementOther" maxlength="100"${values.currentManagement === 'other' ? ' required' : ''} value="${escapeHtml(values.currentManagementOther)}"></div><label for="challenges">Biggest challenges your team faces</label><input id="challenges" name="challenges" maxlength="1000" placeholder="Challenges" value="${escapeHtml(values.challenges)}"><a class="back" href="/onboarding/organization-profile">Back</a><div class="actions"><button type="submit" name="action" value="submit">Next</button><button type="submit" name="action" value="skip" formnovalidate>Skip for now</button></div></form></section></main></body></html>`;
}

function normalizeDiscoveryForm(
  body: Record<string, unknown>,
): Record<string, unknown> {
  if (body.action === 'skip')
    return { action: 'skip', submissionKey: body.submissionKey };
  return Object.fromEntries(
    Object.entries(body).filter(
      ([key, value]) =>
        !['currentManagementOther', 'challenges'].includes(key) || value !== '',
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

function hasAllowedFormOrigin(
  request: express.Request,
  allowedOrigin: string,
): boolean {
  if (request.headers.origin === allowedOrigin) return true;
  const allowedUrl = new URL(allowedOrigin);
  if (
    request.header('sec-fetch-site') === 'same-origin' &&
    allowedUrl.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '::1'].includes(allowedUrl.hostname)
  )
    return true;
  if (request.headers.origin === undefined) return false;
  if (request.headers.origin !== 'null') return false;
  return (
    request.header('sec-fetch-site') === 'same-origin' &&
    request.header('host') === allowedUrl.host
  );
}

export function createApp(
  config: Pick<AppConfig, 'allowedOrigin'> & {
    planSelectionEnabled?: boolean;
    organizationProfileEnabled?: boolean;
    discoveryEnabled?: boolean;
    dashboardEnabled?: boolean;
    loginEnabled?: boolean;
    passwordRecoveryEnabled?: boolean;
    externalAuthEnabled?: boolean;
    sitesEnabled?: boolean;
    allocationPlansEnabled?: boolean;
    allocationPlanDraftsEnabled?: boolean;
    signageScheduleEnabled?: boolean;
    allocationPlanSignsEnabled?: boolean;
    signDocumentsEnabled?: boolean;
    signPhotosEnabled?: boolean;
    signCommentsEnabled?: boolean;
    siteActivityEnabled?: boolean;
  },
  configureRoutes?: ConfigureRoutes,
  onboarding?: OnboardingModule,
  dashboard?: DashboardModule,
  authentication?: AuthenticationModule,
  sites?: SitesModule,
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
  if (authentication) {
    const secure = config.allowedOrigin.startsWith('https://');
    const writeAuthenticationCookies = (
      response: express.Response,
      result: Extract<
        PasswordLoginResult | ExternalLoginResult,
        { status: 'accepted' }
      >,
    ) => {
      if (result.applicationSession) {
        response.cookie(
          applicationAccessCookieName,
          result.applicationSession.accessCredential,
          {
            httpOnly: true,
            sameSite: 'lax',
            secure,
            maxAge: 15 * 60 * 1_000,
            path: '/',
          },
        );
        response.cookie(
          applicationRefreshCookieName,
          result.applicationSession.refreshCredential,
          {
            httpOnly: true,
            sameSite: 'lax',
            secure,
            maxAge: 30 * 24 * 60 * 60 * 1_000,
            path: '/api/dashboard',
          },
        );
      }
      if (result.onboardingSession) {
        response.cookie(
          onboardingCookieName,
          result.onboardingSession.onboardingCredential,
          {
            httpOnly: true,
            sameSite: 'lax',
            secure,
            maxAge: 15 * 60 * 1_000,
            path: '/',
          },
        );
        response.cookie(
          onboardingCsrfCookieName,
          result.onboardingSession.csrfProof,
          {
            httpOnly: false,
            sameSite: 'strict',
            secure,
            maxAge: 15 * 60 * 1_000,
            path: '/',
          },
        );
      }
    };
    const isExternalProvider = (value: string): value is ExternalProvider =>
      externalProviders.some((provider) => provider === value);
    app.get('/auth/start/:provider', async (request, response) => {
      preventRecoveryResponseReuse(response);
      response.vary('Cookie');
      if (
        config.externalAuthEnabled !== true ||
        !authentication.startExternal ||
        !isExternalProvider(request.params.provider) ||
        request.query.intent !== 'login'
      ) {
        response.status(404).send('Not found');
        return;
      }
      try {
        response.redirect(
          303,
          await authentication.startExternal(request.params.provider, 'login'),
        );
      } catch {
        authentication.recordEvent?.('external_provider_unavailable');
        response.redirect(303, '/login?error=provider_unavailable');
      }
    });
    const externalCallback = async (
      request: express.Request,
      response: express.Response,
    ) => {
      preventRecoveryResponseReuse(response);
      response.vary('Cookie');
      const provider = request.params.provider;
      if (
        config.externalAuthEnabled !== true ||
        !authentication.callbackExternal ||
        typeof provider !== 'string' ||
        !isExternalProvider(provider)
      ) {
        response.status(404).send('Not found');
        return;
      }
      const source = (
        request.method === 'POST' ? request.body : request.query
      ) as Record<string, unknown> | undefined;
      const parameters = Object.fromEntries(
        ['code', 'state', 'error', 'error_description'].flatMap((key) =>
          typeof source?.[key] === 'string' ? [[key, source[key]]] : [],
        ),
      ) as Record<string, string>;
      try {
        const result = await authentication.callbackExternal(
          provider,
          parameters,
        );
        if (result.status === 'rejected') {
          response.redirect(303, '/login?error=authentication_failed');
          return;
        }
        writeAuthenticationCookies(response, result);
        response.redirect(303, result.destination);
      } catch {
        authentication.recordEvent?.('external_provider_unavailable');
        response.redirect(303, '/login?error=provider_unavailable');
      }
    };
    app.get('/auth/callback/:provider', externalCallback);
    app.post('/auth/callback/:provider', externalCallback);
    app.get('/login', async (request, response) => {
      if (config.loginEnabled === false) {
        response.status(404).send('Not found');
        return;
      }
      response.set('Cache-Control', 'private, no-store');
      response.vary('Cookie');
      if (dashboard) {
        try {
          const session = await dashboard.load({
            accessCredential: readCookie(
              request.headers.cookie,
              applicationAccessCookieName,
            ),
            refreshCredential: readCookie(
              request.headers.cookie,
              applicationRefreshCookieName,
            ),
          });
          if (session) {
            if (session.applicationSession)
              writeAuthenticationCookies(response, {
                status: 'accepted',
                destination: '/dashboard',
                applicationSession: session.applicationSession,
              });
            response.redirect(303, '/dashboard');
            return;
          }
        } catch {
          // A dashboard dependency failure must not make login unavailable.
        }
      }
      response
        .type('html')
        .send(
          renderLoginForm(
            {},
            '',
            request.query.password_reset === 'success'
              ? 'Your password has been reset. Log in with your new password.'
              : '',
          ),
        );
    });
    app.post('/api/auth/login', async (request, response) => {
      if (config.loginEnabled === false) {
        response.status(404).json({ error: 'not_found' });
        return;
      }
      const isHtmlForm = request.is('application/x-www-form-urlencoded');
      response.set('Cache-Control', 'private, no-store');
      response.vary('Cookie');
      if (
        isHtmlForm
          ? !hasAllowedFormOrigin(request, config.allowedOrigin)
          : request.headers.origin !== config.allowedOrigin
      ) {
        response.status(403).json({ error: 'forbidden' });
        return;
      }
      const rawBody: unknown = request.body;
      const input = loginRequestSchema.safeParse(rawBody);
      if (!input.success) {
        const submittedEmail =
          typeof rawBody === 'object' &&
          rawBody !== null &&
          'email' in rawBody &&
          typeof rawBody.email === 'string'
            ? rawBody.email
            : '';
        if (isHtmlForm)
          response
            .status(400)
            .type('html')
            .send(
              renderLoginForm(
                { email: submittedEmail },
                'Enter a valid email address and password.',
              ),
            );
        else response.status(400).json({ error: 'invalid_request' });
        return;
      }
      try {
        const result = await authentication.login(input.data);
        if (result.status === 'rejected') {
          if (isHtmlForm)
            response
              .status(401)
              .type('html')
              .send(
                renderLoginForm(
                  { email: input.data.email },
                  "We couldn't log you in. Check your details and try again.",
                ),
              );
          else response.status(401).json({ error: 'authentication_failed' });
          return;
        }
        writeAuthenticationCookies(response, result);
        const output = loginResponseSchema.parse({
          destination: result.destination,
        });
        if (isHtmlForm) response.redirect(303, output.destination);
        else response.json(output);
      } catch {
        authentication.recordEvent?.('password_login_unexpected_failure');
        if (isHtmlForm)
          response
            .status(503)
            .type('html')
            .send(
              renderLoginForm(
                { email: input.data.email },
                'Login is temporarily unavailable. Please try again.',
              ),
            );
        else response.status(503).json({ error: 'login_unavailable' });
      }
    });

    app.get('/forgot-password', (_request, response) => {
      if (
        config.passwordRecoveryEnabled === false ||
        !authentication.requestPasswordRecovery
      ) {
        response.status(404).send('Not found');
        return;
      }
      preventRecoveryResponseReuse(response);
      response.type('html').send(renderForgotPasswordForm());
    });
    app.get('/reset-password', (request, response) => {
      if (
        config.passwordRecoveryEnabled === false ||
        !authentication.resetPassword
      ) {
        response.status(404).send('Not found');
        return;
      }
      preventRecoveryResponseReuse(response);
      response
        .type('html')
        .send(renderResetPasswordForm({}, '', request.query.requested === '1'));
    });
    app.post(
      '/api/auth/password-recovery/request',
      async (request, response) => {
        if (
          config.passwordRecoveryEnabled === false ||
          !authentication.requestPasswordRecovery
        ) {
          response.status(404).json({ error: 'not_found' });
          return;
        }
        const isHtmlForm = request.is('application/x-www-form-urlencoded');
        preventRecoveryResponseReuse(response);
        if (
          isHtmlForm
            ? !hasAllowedFormOrigin(request, config.allowedOrigin)
            : request.headers.origin !== config.allowedOrigin
        ) {
          response.status(403).json({ error: 'forbidden' });
          return;
        }
        const rawBody: unknown = request.body;
        const input = passwordRecoveryRequestSchema.safeParse(rawBody);
        if (!input.success) {
          if (isHtmlForm)
            response
              .status(400)
              .type('html')
              .send(
                renderForgotPasswordForm(
                  {
                    email: bodyString(
                      rawBody as Record<string, unknown>,
                      'email',
                    ),
                  },
                  'Enter a valid email address.',
                ),
              );
          else response.status(400).json({ error: 'invalid_request' });
          return;
        }
        try {
          await authentication.requestPasswordRecovery(input.data);
          const output = passwordRecoveryRequestResponseSchema.parse({
            status: 'accepted',
          });
          if (isHtmlForm) response.redirect(303, '/reset-password?requested=1');
          else response.status(202).json(output);
        } catch {
          authentication.recordEvent?.('password_recovery_unexpected_failure');
          if (isHtmlForm)
            response
              .status(503)
              .type('html')
              .send(
                renderForgotPasswordForm(
                  { email: input.data.email },
                  'Password recovery is temporarily unavailable. Please try again.',
                ),
              );
          else
            response
              .status(503)
              .json({ error: 'password_recovery_unavailable' });
        }
      },
    );
    app.post('/api/auth/password-recovery/reset', async (request, response) => {
      if (
        config.passwordRecoveryEnabled === false ||
        !authentication.resetPassword
      ) {
        response.status(404).json({ error: 'not_found' });
        return;
      }
      const isHtmlForm = request.is('application/x-www-form-urlencoded');
      preventRecoveryResponseReuse(response);
      if (
        isHtmlForm
          ? !hasAllowedFormOrigin(request, config.allowedOrigin)
          : request.headers.origin !== config.allowedOrigin
      ) {
        response.status(403).json({ error: 'forbidden' });
        return;
      }
      const submittedBody: unknown = request.body;
      const submittedForm = submittedBody as Record<string, unknown>;
      const allowedFormFields = new Set([
        'email',
        'code',
        'password',
        'confirmPassword',
      ]);
      const hasStrictMatchingConfirmation =
        !isHtmlForm ||
        (typeof submittedBody === 'object' &&
          submittedBody !== null &&
          Object.keys(submittedForm).every((key) =>
            allowedFormFields.has(key),
          ) &&
          bodyString(submittedForm, 'password') ===
            bodyString(submittedForm, 'confirmPassword'));
      const rawBody: unknown = isHtmlForm
        ? {
            email: bodyString(submittedForm, 'email'),
            code: bodyString(submittedForm, 'code'),
            password: bodyString(submittedForm, 'password'),
          }
        : submittedBody;
      const input = passwordResetRequestSchema.safeParse(rawBody);
      if (!input.success || !hasStrictMatchingConfirmation) {
        if (isHtmlForm)
          response
            .status(400)
            .type('html')
            .send(
              renderResetPasswordForm(
                {
                  email: bodyString(
                    submittedBody as Record<string, unknown>,
                    'email',
                  ),
                },
                'Enter a valid email, six-digit code, and compliant new password.',
              ),
            );
        else response.status(400).json({ error: 'invalid_request' });
        return;
      }
      try {
        const result = await authentication.resetPassword(input.data);
        const output = passwordResetResponseSchema.parse(result);
        if (isHtmlForm) response.redirect(303, '/login?password_reset=success');
        else response.json(output);
      } catch (error) {
        if (error instanceof PasswordResetRejectedError) {
          if (isHtmlForm)
            response
              .status(400)
              .type('html')
              .send(
                renderResetPasswordForm(
                  { email: input.data.email },
                  "We couldn't reset your password. Request a new code and try again.",
                ),
              );
          else response.status(400).json({ error: 'password_reset_rejected' });
          return;
        }
        authentication.recordEvent?.('password_reset_unexpected_failure');
        authentication.recordEvent?.('password_reset_unavailable');
        if (isHtmlForm)
          response
            .status(503)
            .type('html')
            .send(
              renderResetPasswordForm(
                { email: input.data.email },
                'Password reset is temporarily unavailable. Please try again.',
              ),
            );
        else response.status(503).json({ error: 'password_reset_unavailable' });
      }
    });
  }
  if (dashboard) {
    const secure = config.allowedOrigin.startsWith('https://');
    const clearApplicationSession = (response: express.Response) => {
      response.clearCookie(applicationAccessCookieName, {
        httpOnly: true,
        sameSite: 'lax',
        secure,
        path: '/',
      });
      response.clearCookie(applicationRefreshCookieName, {
        httpOnly: true,
        sameSite: 'lax',
        secure,
        path: '/api/dashboard',
      });
    };
    app.post('/api/dashboard/logout', async (request, response) => {
      if (config.dashboardEnabled === false) {
        response.status(404).json({ error: 'not_found' });
        return;
      }
      if (request.headers.origin !== config.allowedOrigin) {
        response.status(403).json({ error: 'forbidden' });
        return;
      }
      response.set('Cache-Control', 'private, no-store');
      try {
        await dashboard.logout({
          accessCredential: readCookie(
            request.headers.cookie,
            applicationAccessCookieName,
          ),
          refreshCredential: readCookie(
            request.headers.cookie,
            applicationRefreshCookieName,
          ),
        });
        clearApplicationSession(response);
        response.status(204).send();
      } catch {
        response.status(503).json({ error: 'logout_unavailable' });
      }
    });
    app.get('/api/dashboard', async (request, response) => {
      if (config.dashboardEnabled === false) {
        response.status(404).json({ error: 'not_found' });
        return;
      }
      response.set('Cache-Control', 'private, no-store');
      response.vary('Cookie');
      try {
        const result = await dashboard.load({
          accessCredential: readCookie(
            request.headers.cookie,
            applicationAccessCookieName,
          ),
          refreshCredential: readCookie(
            request.headers.cookie,
            applicationRefreshCookieName,
          ),
        });
        if (!result) {
          dashboard.recordEvent?.('dashboard_authentication_rejected');
          clearApplicationSession(response);
          response.status(401).json({ error: 'authentication_required' });
          return;
        }
        const { applicationSession, ...dashboardResponse } = result;
        if (applicationSession) {
          response.cookie(
            applicationAccessCookieName,
            applicationSession.accessCredential,
            {
              httpOnly: true,
              sameSite: 'lax',
              secure,
              maxAge: 15 * 60 * 1_000,
              path: '/',
            },
          );
          response.cookie(
            applicationRefreshCookieName,
            applicationSession.refreshCredential,
            {
              httpOnly: true,
              sameSite: 'lax',
              secure,
              maxAge: 30 * 24 * 60 * 60 * 1_000,
              path: '/api/dashboard',
            },
          );
        }
        response.json(dashboardResponseSchema.parse(dashboardResponse));
      } catch (error) {
        dashboard.recordEvent?.('dashboard_unexpected_failure');
        throw error;
      }
    });
  }
  if (sites) {
    const preparePrivateSiteResponse = (response: express.Response) => {
      response.set('Cache-Control', 'private, no-store');
      response.vary('Cookie');
      response.vary('Origin');
    };
    const readApplicationCredential = (request: express.Request) =>
      readCookie(request.headers.cookie, applicationAccessCookieName);

    app.get('/api/sites', async (request, response) => {
      preparePrivateSiteResponse(response);
      if (config.sitesEnabled === false) {
        response.status(404).json({ error: 'not_found' });
        return;
      }
      const credential = readApplicationCredential(request);
      if (!credential) {
        response.status(401).json({ error: 'authentication_required' });
        return;
      }
      try {
        const result = await sites.load(credential);
        if (!result) {
          response.status(401).json({ error: 'authentication_required' });
          return;
        }
        response.json(sitesPageResponseSchema.parse(result));
      } catch {
        sites.recordEvent?.('sites_load_unavailable');
        response.status(503).json({ error: 'sites_unavailable' });
      }
    });

    app.post('/api/sites', async (request, response) => {
      preparePrivateSiteResponse(response);
      if (config.sitesEnabled === false) {
        response.status(404).json({ error: 'not_found' });
        return;
      }
      if (!hasAllowedFormOrigin(request, config.allowedOrigin)) {
        response.status(403).json({ error: 'forbidden' });
        return;
      }
      const credential = readApplicationCredential(request);
      if (!credential) {
        response.status(401).json({ error: 'authentication_required' });
        return;
      }
      const currentInput = createSiteRequestSchema.safeParse(request.body);
      let input: CreateSiteRequest;
      if (currentInput.success) input = currentInput.data;
      else {
        const legacyInput = legacyCreateSiteRequestSchema.safeParse(
          request.body,
        );
        if (!legacyInput.success) {
          sites.recordEvent?.('site_create_rejected_invalid_request');
          response.status(400).json({ error: 'invalid_request' });
          return;
        }
        sites.recordEvent?.('site_create_legacy_request');
        input = {
          name: legacyInput.data.name,
          accessScope: 'ORGANIZATION',
          organizationAccess: legacyInput.data.organizationAccess,
          idempotencyKey: legacyInput.data.idempotencyKey,
        };
      }
      try {
        const result = await sites.create(credential, input);
        if (!result) {
          sites.recordEvent?.('site_create_rejected_authentication');
          response.status(401).json({ error: 'authentication_required' });
          return;
        }
        const responseBody = createSiteResponseSchema.parse(result);
        sites.recordEvent?.(
          `site_create_succeeded_${input.accessScope.toLowerCase()}`,
        );
        response.status(201).json(responseBody);
      } catch (error) {
        if (error instanceof SitesForbiddenError) {
          sites.recordEvent?.('site_create_rejected_forbidden');
          response.status(403).json({ error: error.code });
          return;
        }
        if (
          error instanceof SitesUpgradeRequiredError ||
          error instanceof SitesPaidSeatRequiredError ||
          error instanceof SitesConflictError
        ) {
          sites.recordEvent?.(
            `site_create_rejected_${error.code.replace('sites_', '')}`,
          );
          response.status(409).json({ error: error.code });
          return;
        }
        sites.recordEvent?.('site_create_unavailable');
        response.status(503).json({ error: 'sites_unavailable' });
      }
    });

    app.get('/api/sites/:siteId', async (request, response) => {
      preparePrivateSiteResponse(response);
      if (config.sitesEnabled === false) {
        response.status(404).json({ error: 'not_found' });
        return;
      }
      const parsedSiteId = createSiteResponseSchema.shape.siteId.safeParse(
        request.params.siteId,
      );
      if (!parsedSiteId.success) {
        response.status(400).json({ error: 'invalid_request' });
        return;
      }
      const credential = readApplicationCredential(request);
      if (!credential) {
        response.status(401).json({ error: 'authentication_required' });
        return;
      }
      try {
        const result = await sites.activity(credential, parsedSiteId.data);
        if (!result) {
          response.status(401).json({ error: 'authentication_required' });
          return;
        }
        response.json(siteActivityResponseSchema.parse(result));
      } catch (error) {
        if (error instanceof SitesNotFoundError) {
          response.status(404).json({ error: 'site_not_found' });
          return;
        }
        sites.recordEvent?.('site_activity_unavailable');
        response.status(503).json({ error: 'sites_unavailable' });
      }
    });

    app.get('/api/sites/:siteId/activity', async (request, response) => {
      preparePrivateSiteResponse(response);
      if (!config.siteActivityEnabled || !sites.listSiteActivity)
        return response.status(404).json({ error: 'not_found' });
      const id = createSiteResponseSchema.shape.siteId.safeParse(
        request.params.siteId,
      );
      const cursor = request.query.cursor;
      if (
        !id.success ||
        (cursor !== undefined &&
          (typeof cursor !== 'string' ||
            cursor.length < 1 ||
            cursor.length > 512))
      )
        return response.status(400).json({ error: 'invalid_request' });
      const credential = readApplicationCredential(request);
      if (!credential)
        return response.status(401).json({ error: 'authentication_required' });
      try {
        const result = await sites.listSiteActivity(
          credential,
          id.data,
          cursor,
        );
        return result
          ? response.json(siteActivityPageResponseSchema.parse(result))
          : response.status(401).json({ error: 'authentication_required' });
      } catch (error) {
        if (error instanceof SiteActivityNotFoundError)
          return response.status(404).json({ error: 'site_not_found' });
        sites.recordEvent?.('site_activity_read_unavailable');
        return response
          .status(503)
          .json({ error: 'site_activity_unavailable' });
      }
    });

    app.post('/api/sites/:siteId/comments', async (request, response) => {
      preparePrivateSiteResponse(response);
      if (!config.siteActivityEnabled || !sites.createSiteComment)
        return response.status(404).json({ error: 'not_found' });
      const id = createSiteResponseSchema.shape.siteId.safeParse(
        request.params.siteId,
      );
      const input = createSiteCommentRequestSchema.safeParse(request.body);
      if (!hasAllowedFormOrigin(request, config.allowedOrigin))
        return response.status(403).json({ error: 'forbidden_origin' });
      if (!id.success || !input.success)
        return response.status(400).json({ error: 'invalid_request' });
      const credential = readApplicationCredential(request);
      if (!credential)
        return response.status(401).json({ error: 'authentication_required' });
      try {
        const result = await sites.createSiteComment(
          credential,
          id.data,
          input.data.text,
        );
        return result
          ? response.status(201).json(siteActivityItemSchema.parse(result))
          : response.status(401).json({ error: 'authentication_required' });
      } catch (error) {
        if (error instanceof SiteActivityNotFoundError)
          return response.status(404).json({ error: 'site_not_found' });
        sites.recordEvent?.('site_comment_create_unavailable');
        return response.status(503).json({ error: 'site_comment_unavailable' });
      }
    });

    const signageResponse = (response: express.Response, error: unknown) => {
      if (error instanceof SignageForbiddenError)
        return response.status(403).json({ error: 'signage_forbidden' });
      if (error instanceof SignageNotFoundError)
        return response.status(404).json({ error: 'signage_not_found' });
      if (error instanceof SignageConflictError)
        return response.status(409).json({ error: 'signage_conflict' });
      return response.status(503).json({ error: 'signage_unavailable' });
    };
    if (sites.signPhotos) registerSignPhotoRoutes(app, { ...sites.signPhotos, enabled: !!config.signPhotosEnabled && !!config.allocationPlanSignsEnabled, allowedOrigin: config.allowedOrigin });
    if (sites.signComments) registerSignCommentRoutes(app, { ...sites.signComments, enabled: !!config.signCommentsEnabled && !!config.allocationPlanSignsEnabled, allowedOrigin: config.allowedOrigin });
    if (sites.signDocuments)
      registerSignDocumentRoutes(app, {
        ...sites.signDocuments,
        enabled:
          !!config.signDocumentsEnabled && !!config.allocationPlanSignsEnabled,
        allowedOrigin: config.allowedOrigin,
      });
    app.all(
      [
        '/api/sites/:siteId/allocation-plans/:planId/signs',
        '/api/sites/:siteId/allocation-plans/:planId/signs/:signId',
      ],
      async (request, response) => {
        preparePrivateSiteResponse(response);
        if (!config.allocationPlanSignsEnabled || !sites.planSigns)
          return response.status(404).json({ error: 'not_found' });
        const credential = readApplicationCredential(request);
        if (!credential)
          return response
            .status(401)
            .json({ error: 'authentication_required' });
        const uuid = createSiteResponseSchema.shape.siteId;
        const siteId = uuid.safeParse(request.params.siteId);
        const planId = uuid.safeParse(request.params.planId);
        const signId = uuid.safeParse(request.params.signId);
        if (!siteId.success || !planId.success)
          return response.status(400).json({ error: 'invalid_request' });
        if (
          request.method !== 'GET' &&
          request.headers.origin !== config.allowedOrigin
        )
          return response.status(403).json({ error: 'invalid_origin' });
        try {
          let result: unknown;
          if (request.method === 'GET' && !request.params.signId) {
            const fileId =
              request.query.fileId === undefined
                ? null
                : uuid.safeParse(request.query.fileId);
            if (fileId !== null && !fileId.success)
              return response.status(400).json({ error: 'invalid_request' });
            const loaded = await sites.planSigns.load(
              credential,
              siteId.data,
              planId.data,
              fileId?.data ?? null,
            );
            result =
              loaded &&
              planSignsResponseSchema.parse({
                ...loaded,
                documentsEnabled: !!config.signDocumentsEnabled,
                photosEnabled: !!config.signPhotosEnabled,
                commentsEnabled: !!config.signCommentsEnabled,
              });
          } else if (request.method === 'POST' && !request.params.signId) {
            const input = planSignCreateSchema.safeParse(request.body);
            if (!input.success)
              return response.status(400).json({ error: 'invalid_request' });
            const created = await sites.planSigns.create(
              credential,
              siteId.data,
              planId.data,
              input.data,
            );
            result = created && planSignSchema.parse(created);
          } else if (request.method === 'PATCH' && signId.success) {
            const input = planSignPatchSchema.safeParse(request.body);
            if (!input.success)
              return response.status(400).json({ error: 'invalid_request' });
            const updated = await sites.planSigns.update(
              credential,
              siteId.data,
              planId.data,
              signId.data,
              input.data,
            );
            result = updated && planSignSchema.parse(updated);
          } else if (request.method === 'DELETE' && signId.success) {
            const input = planSignDeleteSchema.safeParse(request.body);
            if (!input.success)
              return response.status(400).json({ error: 'invalid_request' });
            result = (await sites.planSigns.remove(
              credential,
              siteId.data,
              planId.data,
              signId.data,
              input.data.expectedUpdatedAt,
            ))
              ? { deleted: true }
              : null;
          } else
            return response.status(405).json({ error: 'method_not_allowed' });
          sites.recordEvent?.(
            `plan_sign_${request.method.toLowerCase()}_success`,
          );
          return result
            ? response
                .status(request.method === 'POST' ? 201 : 200)
                .json(result)
            : response.status(401).json({ error: 'authentication_required' });
        } catch (error) {
          sites.recordEvent?.(
            `plan_sign_${request.method.toLowerCase()}_failure`,
          );
          return signageResponse(response, error);
        }
      },
    );
    app.get(
      '/api/sites/:siteId/signage-schedule',
      async (request, response) => {
        preparePrivateSiteResponse(response);
        if (!config.signageScheduleEnabled || !sites.loadSignageSchedule)
          return response.status(404).json({ error: 'not_found' });
        const id = createSiteResponseSchema.shape.siteId.safeParse(
          request.params.siteId,
        );
        const credential = readApplicationCredential(request);
        if (!id.success)
          return response.status(400).json({ error: 'invalid_request' });
        if (!credential)
          return response
            .status(401)
            .json({ error: 'authentication_required' });
        try {
          const result = await sites.loadSignageSchedule(credential, id.data);
          return result
            ? response.json(signageScheduleResponseSchema.parse(result))
            : response.status(401).json({ error: 'authentication_required' });
        } catch (error) {
          return signageResponse(response, error);
        }
      },
    );
    app.post('/api/sites/:siteId/sign-types', async (request, response) => {
      preparePrivateSiteResponse(response);
      if (!config.signageScheduleEnabled || !sites.createSignType)
        return response.status(404).json({ error: 'not_found' });
      const id = createSiteResponseSchema.shape.siteId.safeParse(
          request.params.siteId,
        ),
        body = createSignTypeRequestSchema.safeParse(request.body),
        credential = readApplicationCredential(request);
      if (!id.success || !body.success)
        return response.status(400).json({ error: 'invalid_request' });
      if (!credential)
        return response.status(401).json({ error: 'authentication_required' });
      try {
        const result = await sites.createSignType(
          credential,
          id.data,
          body.data.name,
        );
        return result
          ? response.status(201).json(result)
          : response.status(401).json({ error: 'authentication_required' });
      } catch (error) {
        return signageResponse(response, error);
      }
    });
    app.patch(
      '/api/sites/:siteId/sign-types/:signTypeId',
      async (request, response) => {
        preparePrivateSiteResponse(response);
        if (!config.signageScheduleEnabled || !sites.updateSignType)
          return response.status(404).json({ error: 'not_found' });
        const site = createSiteResponseSchema.shape.siteId.safeParse(
            request.params.siteId,
          ),
          id = createSiteResponseSchema.shape.siteId.safeParse(
            request.params.signTypeId,
          ),
          body = updateSignTypeRequestSchema.safeParse(request.body),
          credential = readApplicationCredential(request);
        if (!site.success || !id.success || !body.success)
          return response.status(400).json({ error: 'invalid_request' });
        if (!credential)
          return response
            .status(401)
            .json({ error: 'authentication_required' });
        try {
          const result = await sites.updateSignType(
            credential,
            site.data,
            id.data,
            body.data.name,
            body.data.expectedUpdatedAt,
          );
          return result
            ? response.json(result)
            : response.status(401).json({ error: 'authentication_required' });
        } catch (error) {
          return signageResponse(response, error);
        }
      },
    );
    app.post(
      '/api/sites/:siteId/sign-types/:signTypeId/signs',
      async (request, response) => {
        preparePrivateSiteResponse(response);
        if (!config.signageScheduleEnabled || !sites.createSign)
          return response.status(404).json({ error: 'not_found' });
        const site = createSiteResponseSchema.shape.siteId.safeParse(
            request.params.siteId,
          ),
          id = createSiteResponseSchema.shape.siteId.safeParse(
            request.params.signTypeId,
          ),
          body = createSignRequestSchema.safeParse(request.body),
          credential = readApplicationCredential(request);
        if (!site.success || !id.success || !body.success)
          return response.status(400).json({ error: 'invalid_request' });
        if (!credential)
          return response
            .status(401)
            .json({ error: 'authentication_required' });
        try {
          const result = await sites.createSign(
            credential,
            site.data,
            id.data,
            body.data,
          );
          return result
            ? response.status(201).json(result)
            : response.status(401).json({ error: 'authentication_required' });
        } catch (error) {
          return signageResponse(response, error);
        }
      },
    );
    app.patch('/api/sites/:siteId/signs/:signId', async (request, response) => {
      preparePrivateSiteResponse(response);
      if (!config.signageScheduleEnabled || !sites.updateSign)
        return response.status(404).json({ error: 'not_found' });
      const site = createSiteResponseSchema.shape.siteId.safeParse(
          request.params.siteId,
        ),
        id = createSiteResponseSchema.shape.siteId.safeParse(
          request.params.signId,
        ),
        body = updateSignRequestSchema.safeParse(request.body),
        credential = readApplicationCredential(request);
      if (!site.success || !id.success || !body.success)
        return response.status(400).json({ error: 'invalid_request' });
      if (!credential)
        return response.status(401).json({ error: 'authentication_required' });
      try {
        const result = await sites.updateSign(
          credential,
          site.data,
          id.data,
          body.data,
        );
        return result
          ? response.json(result)
          : response.status(401).json({ error: 'authentication_required' });
      } catch (error) {
        return signageResponse(response, error);
      }
    });

    app.get(
      '/api/sites/:siteId/allocation-plans',
      async (request, response) => {
        preparePrivateSiteResponse(response);
        if (!config.allocationPlansEnabled || !sites.listAllocationPlans) {
          response.status(404).json({ error: 'not_found' });
          return;
        }
        const siteId = createSiteResponseSchema.shape.siteId.safeParse(
          request.params.siteId,
        );
        const credential = readApplicationCredential(request);
        if (!siteId.success) {
          response.status(400).json({ error: 'invalid_request' });
          return;
        }
        if (!credential) {
          response.status(401).json({ error: 'authentication_required' });
          return;
        }
        try {
          const result = await sites.listAllocationPlans(
            credential,
            siteId.data,
          );
          if (!result) {
            response.status(401).json({ error: 'authentication_required' });
            return;
          }
          response.json(allocationPlansResponseSchema.parse(result));
        } catch (error) {
          if (error instanceof AllocationPlansNotFoundError) {
            response.status(404).json({ error: 'site_not_found' });
            return;
          }
          sites.recordEvent?.('allocation_plans_load_unavailable');
          response.status(503).json({ error: 'allocation_plans_unavailable' });
        }
      },
    );

    app.get(
      [
        '/api/sites/:siteId/allocation-plans/:planId/content',
        '/api/sites/:siteId/allocation-plans/:planId/files/:fileId/content',
      ],
      async (request, response) => {
        preparePrivateSiteResponse(response);
        response.setHeader('X-Content-Type-Options', 'nosniff');
        response.setHeader(
          'Content-Security-Policy',
          "default-src 'none'; sandbox",
        );
        if (
          !config.allocationPlansEnabled ||
          !sites.loadAllocationPlanContent
        ) {
          response.status(404).json({ error: 'not_found' });
          return;
        }
        const siteId = createSiteResponseSchema.shape.siteId.safeParse(
          request.params.siteId,
        );
        const planId = createSiteResponseSchema.shape.siteId.safeParse(
          request.params.planId,
        );
        const credential = readApplicationCredential(request);
        const fileId =
          request.params.fileId === undefined
            ? undefined
            : createSiteResponseSchema.shape.siteId.safeParse(
                request.params.fileId,
              );
        if (!siteId.success || !planId.success || (fileId && !fileId.success)) {
          response.status(400).json({ error: 'invalid_request' });
          return;
        }
        if (!credential) {
          response.status(401).json({ error: 'authentication_required' });
          return;
        }
        try {
          const result = await sites.loadAllocationPlanContent(
            credential,
            siteId.data,
            planId.data,
            ...(fileId?.success ? [fileId.data] : []),
          );
          if (!result) {
            response.status(401).json({ error: 'authentication_required' });
            return;
          }
          response.type(result.mediaType).send(Buffer.from(result.bytes));
        } catch (error) {
          if (
            error instanceof AllocationPlansNotFoundError ||
            error instanceof AllocationPlanUploadRejectedError
          ) {
            response.status(404).json({ error: 'allocation_plan_not_found' });
            return;
          }
          sites.recordEvent?.('allocation_plan_preview_unavailable');
          response.status(503).json({ error: 'allocation_plan_unavailable' });
        }
      },
    );

    for (const operation of ['create', 'verify', 'commit'] as const) {
      const path =
        '/api/sites/:siteId/allocation-plan-drafts' +
        (operation === 'create'
          ? ''
          : operation === 'verify'
            ? '/:uploadId/verify'
            : '/commit');
      app.post(path, async (request, response) => {
        preparePrivateSiteResponse(response);
        if (
          !config.allocationPlansEnabled ||
          !config.allocationPlanDraftsEnabled
        ) {
          response.status(404).json({ error: 'not_found' });
          return;
        }
        if (!hasAllowedFormOrigin(request, config.allowedOrigin)) {
          response.status(403).json({ error: 'forbidden' });
          return;
        }
        const credential = readApplicationCredential(request);
        if (!credential) {
          response.status(401).json({ error: 'authentication_required' });
          return;
        }
        const siteId = createSiteResponseSchema.shape.siteId.safeParse(
          request.params.siteId,
        );
        if (!siteId.success) {
          response.status(400).json({ error: 'invalid_request' });
          return;
        }
        try {
          let result;
          if (operation === 'create') {
            const input =
              createAllocationPlanUploadBatchRequestSchema.safeParse(
                request.body,
              );
            if (!input.success) {
              response.status(400).json({ error: 'invalid_request' });
              return;
            }
            result = await sites.createAllocationPlanDraft?.(
              credential,
              siteId.data,
              input.data,
            );
            if (result)
              response
                .status(201)
                .json(
                  createAllocationPlanUploadBatchResponseSchema.parse(result),
                );
          } else if (operation === 'verify') {
            const id = createSiteResponseSchema.shape.siteId.safeParse(
              request.params.uploadId,
            );
            if (!id.success) {
              response.status(400).json({ error: 'invalid_request' });
              return;
            }
            result = await sites.verifyAllocationPlanDraft?.(
              credential,
              siteId.data,
              id.data,
            );
            if (result)
              response.json(
                verifyAllocationPlanDraftResponseSchema.parse(result),
              );
          } else {
            const input = commitAllocationPlanDraftRequestSchema.safeParse(
              request.body,
            );
            if (!input.success) {
              response.status(400).json({ error: 'invalid_request' });
              return;
            }
            result = await sites.commitAllocationPlanDraft?.(
              credential,
              siteId.data,
              input.data,
            );
            if (result)
              response
                .status(201)
                .json(finalizeAllocationPlanUploadResponseSchema.parse(result));
          }
          if (!result)
            response.status(401).json({ error: 'authentication_required' });
        } catch (error) {
          if (error instanceof AllocationPlansNotFoundError)
            response.status(404).json({ error: 'not_found' });
          else if (error instanceof AllocationPlansForbiddenError)
            response.status(403).json({ error: 'forbidden' });
          else if (error instanceof AllocationPlanUploadRejectedError)
            response
              .status(409)
              .json({ error: 'allocation_draft_upload_rejected' });
          else if (error instanceof AllocationPlansConflictError)
            response.status(409).json({ error: 'allocation_draft_conflict' });
          else {
            sites.recordEvent?.(`allocation_draft_${operation}_unavailable`);
            response
              .status(503)
              .json({ error: 'allocation_plans_unavailable' });
          }
        }
      });
    }
    app.post(
      '/api/sites/:siteId/allocation-plan-upload-batches',
      async (request, response) => {
        preparePrivateSiteResponse(response);
        if (
          !config.allocationPlansEnabled ||
          !sites.createAllocationPlanUploadBatch
        ) {
          response.status(404).json({ error: 'not_found' });
          return;
        }
        if (!hasAllowedFormOrigin(request, config.allowedOrigin)) {
          response.status(403).json({ error: 'forbidden' });
          return;
        }
        const siteId = createSiteResponseSchema.shape.siteId.safeParse(
          request.params.siteId,
        );
        const input = createAllocationPlanUploadBatchRequestSchema.safeParse(
          request.body,
        );
        const credential = readApplicationCredential(request);
        if (!siteId.success || !input.success) {
          response.status(400).json({ error: 'invalid_request' });
          return;
        }
        if (!credential) {
          response.status(401).json({ error: 'authentication_required' });
          return;
        }
        try {
          const result = await sites.createAllocationPlanUploadBatch(
            credential,
            siteId.data,
            input.data,
          );
          if (!result) {
            response.status(401).json({ error: 'authentication_required' });
            return;
          }
          response
            .status(201)
            .json(createAllocationPlanUploadBatchResponseSchema.parse(result));
        } catch (error) {
          if (error instanceof AllocationPlansNotFoundError) {
            response.status(404).json({ error: 'site_not_found' });
            return;
          }
          if (error instanceof AllocationPlansForbiddenError) {
            response.status(403).json({ error: 'allocation_plans_forbidden' });
            return;
          }
          if (error instanceof AllocationPlansConflictError) {
            response.status(409).json({ error: 'allocation_plans_conflict' });
            return;
          }
          if (error instanceof AllocationPlanUploadRejectedError) {
            response.status(400).json({ error: 'invalid_request' });
            return;
          }
          sites.recordEvent?.('allocation_plan_intent_unavailable');
          response.status(503).json({ error: 'allocation_plans_unavailable' });
        }
      },
    );

    app.post(
      '/api/sites/:siteId/allocation-plan-uploads/:uploadId/finalize',
      async (request, response) => {
        preparePrivateSiteResponse(response);
        if (
          !config.allocationPlansEnabled ||
          !sites.finalizeAllocationPlanUpload
        ) {
          response.status(404).json({ error: 'not_found' });
          return;
        }
        if (!hasAllowedFormOrigin(request, config.allowedOrigin)) {
          response.status(403).json({ error: 'forbidden' });
          return;
        }
        const siteId = createSiteResponseSchema.shape.siteId.safeParse(
          request.params.siteId,
        );
        const uploadId = createSiteResponseSchema.shape.siteId.safeParse(
          request.params.uploadId,
        );
        const credential = readApplicationCredential(request);
        if (!siteId.success || !uploadId.success) {
          response.status(400).json({ error: 'invalid_request' });
          return;
        }
        if (!credential) {
          response.status(401).json({ error: 'authentication_required' });
          return;
        }
        try {
          const result = await sites.finalizeAllocationPlanUpload(
            credential,
            siteId.data,
            uploadId.data,
          );
          if (!result) {
            response.status(401).json({ error: 'authentication_required' });
            return;
          }
          response.json(
            finalizeAllocationPlanUploadResponseSchema.parse(result),
          );
        } catch (error) {
          if (error instanceof AllocationPlansNotFoundError) {
            response.status(404).json({ error: 'site_not_found' });
            return;
          }
          if (error instanceof AllocationPlansForbiddenError) {
            response.status(403).json({ error: 'allocation_plans_forbidden' });
            return;
          }
          if (error instanceof AllocationPlanUploadRejectedError) {
            response
              .status(409)
              .json({ error: 'allocation_plan_upload_rejected' });
            return;
          }
          sites.recordEvent?.('allocation_plan_finalize_unavailable');
          response.status(503).json({ error: 'allocation_plans_unavailable' });
        }
      },
    );
  }
  if (!onboarding)
    app.get('/onboarding/about-you', (_request, response) => {
      response.type('html').send(renderAboutYouForm());
    });
  if (onboarding) {
    const personalProfileOnboarding = onboarding as OnboardingModule &
      Required<Pick<OnboardingModule, 'loadPersonalProfile'>>;
    const planOnboarding = onboarding as OnboardingModule &
      Required<Pick<OnboardingModule, 'load' | 'select'>>;
    const organizationOnboarding = onboarding as OnboardingModule &
      Required<
        Pick<
          OnboardingModule,
          'loadOrganizationProfile' | 'submitOrganizationProfile'
        >
      >;
    const discoveryOnboarding = onboarding as OnboardingModule &
      Required<Pick<OnboardingModule, 'loadDiscovery' | 'completeDiscovery'>>;
    const recordOrganizationEvent = (name: string) => {
      onboarding.recordOrganizationProfileEvent?.(name);
    };
    const recordDiscoveryEvent = (name: string) => {
      onboarding.recordDiscoveryEvent?.(name);
    };
    const readOnboardingCredential = (request: express.Request) =>
      readCookie(request.headers.cookie, onboardingCookieName);
    const clearOnboardingSession = (response: express.Response) => {
      const secure = config.allowedOrigin.startsWith('https://');
      response.clearCookie(onboardingCookieName, {
        httpOnly: true,
        sameSite: 'lax',
        secure,
        path: '/',
      });
      response.clearCookie(onboardingCsrfCookieName, {
        httpOnly: false,
        sameSite: 'strict',
        secure,
        path: '/',
      });
    };
    app.get('/onboarding/about-you', async (request, response) => {
      response.set('Cache-Control', 'private, no-store');
      const credential = readOnboardingCredential(request);
      if (!credential) {
        clearOnboardingSession(response);
        response.redirect(303, '/onboarding');
        return;
      }
      try {
        const { profile } =
          await personalProfileOnboarding.loadPersonalProfile(credential);
        response.type('html').send(renderAboutYouForm(profile ?? {}));
      } catch (error) {
        if (error instanceof PersonalProfileTransitionError) {
          clearOnboardingSession(response);
          response.redirect(303, '/onboarding');
          return;
        }
        throw error;
      }
    });
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
    app.get('/api/onboarding/personal-profile', async (request, response) => {
      response.set('Cache-Control', 'private, no-store');
      const credential = readOnboardingCredential(request);
      if (!credential) {
        clearOnboardingSession(response);
        response.status(401).json({ error: 'onboarding_session_expired' });
        return;
      }
      try {
        response.json(
          personalProfilePageResponseSchema.parse(
            await personalProfileOnboarding.loadPersonalProfile(credential),
          ),
        );
      } catch (error) {
        if (error instanceof PersonalProfileTransitionError) {
          clearOnboardingSession(response);
          response.status(401).json({ error: 'onboarding_session_expired' });
          return;
        }
        throw error;
      }
    });
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
      const hasAllowedOrigin = isHtmlForm
        ? hasAllowedFormOrigin(request, config.allowedOrigin)
        : request.headers.origin === config.allowedOrigin;
      if (!hasAllowedOrigin) {
        reject(401, 'onboarding_transition_failed');
        return;
      }
      if (!credential || !csrfCookie) {
        clearOnboardingSession(response);
        if (isHtmlForm) response.redirect(303, '/onboarding');
        else response.status(401).json({ error: 'onboarding_session_expired' });
        return;
      }
      if (!isHtmlForm && csrfHeader !== csrfCookie) {
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
          clearOnboardingSession(response);
          if (isHtmlForm) response.redirect(303, '/onboarding');
          else
            response.status(401).json({ error: 'onboarding_session_expired' });
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
    app.get('/api/onboarding/discovery', async (request, response) => {
      if (config.discoveryEnabled === false) {
        response.status(404).json({ error: 'not_found' });
        return;
      }
      response.set('Cache-Control', 'private, no-store');
      const credential = readOnboardingCredential(request);
      if (!credential) {
        recordDiscoveryEvent('discovery_transition_rejected');
        clearOnboardingSession(response);
        response.status(401).json({ error: 'onboarding_session_expired' });
        return;
      }
      try {
        response.json(
          discoveryPageResponseSchema.parse(
            await discoveryOnboarding.loadDiscovery(credential),
          ),
        );
      } catch (error) {
        if (error instanceof DiscoveryTransitionError) {
          clearOnboardingSession(response);
          response.status(401).json({ error: 'onboarding_session_expired' });
          return;
        }
        recordDiscoveryEvent('discovery_unexpected_failure');
        throw error;
      }
    });
    app.get('/onboarding/discovery', async (request, response) => {
      if (config.discoveryEnabled === false) {
        response.status(404).type('html').send('Not found.');
        return;
      }
      response.set('Cache-Control', 'private, no-store');
      const credential = readOnboardingCredential(request);
      if (!credential) {
        clearOnboardingSession(response);
        response.redirect(303, '/onboarding');
        return;
      }
      try {
        response
          .type('html')
          .send(
            renderDiscovery(
              await discoveryOnboarding.loadDiscovery(credential),
            ),
          );
      } catch (error) {
        if (error instanceof DiscoveryTransitionError) {
          clearOnboardingSession(response);
          response.redirect(303, '/onboarding');
          return;
        }
        recordDiscoveryEvent('discovery_unexpected_failure');
        throw error;
      }
    });
    app.post('/api/onboarding/discovery', async (request, response) => {
      if (config.discoveryEnabled === false) {
        response.status(404).json({ error: 'not_found' });
        return;
      }
      const isHtmlForm = request.is('application/x-www-form-urlencoded');
      const input = discoveryRequestSchema.safeParse(
        isHtmlForm
          ? normalizeDiscoveryForm(request.body as Record<string, unknown>)
          : request.body,
      );
      const credential = readOnboardingCredential(request);
      const csrfCookie = readCookie(
        request.headers.cookie,
        onboardingCsrfCookieName,
      );
      const reject = async (status: number, error: string) => {
        if (isHtmlForm && credential) {
          try {
            const state = await discoveryOnboarding.loadDiscovery(credential);
            response
              .status(status)
              .type('html')
              .send(
                renderDiscovery(
                  state,
                  request.body as Record<string, unknown>,
                  'We could not save your answers. Review the form and try again.',
                ),
              );
            return;
          } catch (loadError) {
            if (!(loadError instanceof DiscoveryTransitionError))
              throw loadError;
          }
        }
        if (isHtmlForm)
          response
            .status(status)
            .type('html')
            .send('We could not save your answers.');
        else response.status(status).json({ error });
      };
      if (!input.success) {
        recordDiscoveryEvent('discovery_validation_rejected');
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
        recordDiscoveryEvent('discovery_transition_rejected');
        await reject(401, 'onboarding_transition_failed');
        return;
      }
      try {
        const { applicationSession, ...result } =
          await discoveryOnboarding.completeDiscovery(
            credential,
            csrfCookie,
            input.data,
          );
        const output = discoveryResponseSchema.parse(result);
        if (applicationSession) {
          const secure = config.allowedOrigin.startsWith('https://');
          response.cookie(
            applicationAccessCookieName,
            applicationSession.accessCredential,
            {
              httpOnly: true,
              sameSite: 'lax',
              secure,
              maxAge: 15 * 60 * 1_000,
              path: '/',
            },
          );
          response.cookie(
            applicationRefreshCookieName,
            applicationSession.refreshCredential,
            {
              httpOnly: true,
              sameSite: 'lax',
              secure,
              maxAge: 30 * 24 * 60 * 60 * 1_000,
              path: '/api/dashboard',
            },
          );
        }
        clearOnboardingSession(response);
        if (isHtmlForm) response.redirect(303, output.destination);
        else response.json(output);
      } catch (error) {
        if (error instanceof DiscoveryConflictError) {
          await reject(409, 'discovery_conflict');
          return;
        }
        if (error instanceof DiscoveryTransitionError) {
          await reject(409, 'onboarding_transition_failed');
          return;
        }
        recordDiscoveryEvent('discovery_unexpected_failure');
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
