import {
  createOnboardingAccountResponseSchema,
  healthResponseSchema,
  resendOnboardingVerificationResponseSchema,
  verifyOnboardingEmailResponseSchema,
  type CreateOnboardingAccountRequest,
  type CreateOnboardingAccountResponse,
  type HealthResponse,
  type ResendOnboardingVerificationRequest,
  type ResendOnboardingVerificationResponse,
  type VerifyOnboardingEmailRequest,
  type VerifyOnboardingEmailResponse,
  personalProfileResponseSchema,
  personalProfilePageResponseSchema,
  type PersonalProfilePageResponse,
  type PersonalProfileRequest,
  type PersonalProfileResponse,
  planSelectionPageResponseSchema,
  planSelectionResponseSchema,
  type PlanPriceId,
  type PlanSelectionPageResponse,
  type PlanSelectionResponse,
  organizationProfilePageResponseSchema,
  organizationProfileResponseSchema,
  type OrganizationProfilePageResponse,
  type OrganizationProfileRequest,
  type OrganizationProfileResponse,
  discoveryPageResponseSchema,
  discoveryResponseSchema,
  type DiscoveryPageResponse,
  type DiscoveryRequest,
  type DiscoveryResponse,
  dashboardResponseSchema,
  type DashboardResponse,
  loginResponseSchema,
  type LoginRequest,
  type LoginResponse,
  passwordRecoveryRequestResponseSchema,
  passwordResetResponseSchema,
  type PasswordRecoveryRequest,
  type PasswordRecoveryRequestResponse,
  type PasswordResetRequest,
  type PasswordResetResponse,
  createSiteResponseSchema,
  siteActivityResponseSchema,
  sitesPageResponseSchema,
  type CreateSiteRequest,
  type CreateSiteResponse,
  type SiteActivityResponse,
  type SitesPageResponse,
  allocationPlansResponseSchema,
  createAllocationPlanUploadBatchResponseSchema,
  finalizeAllocationPlanUploadResponseSchema,
  type AllocationPlansResponse,
  type CreateAllocationPlanUploadBatchRequest,
  type CreateAllocationPlanUploadBatchResponse,
  type FinalizeAllocationPlanUploadResponse,
  signageScheduleResponseSchema,
  signTypeSchema,
  signSchema,
  type SignageScheduleResponse,
  type SignType,
  type Sign,
  siteActivityPageResponseSchema,
  siteActivityItemSchema,
  type SiteActivityPageResponse,
  type SiteActivityItem,
} from '@hansel/contracts';

async function signageRequest(
  path: string,
  baseUrl: string,
  init?: RequestInit,
  fetcher: typeof fetch = fetch,
) {
  const response = await fetcher(`${baseUrl}${path}`, {
    credentials: 'include',
    ...init,
  });
  if (response.status === 401) throw new DashboardAuthenticationRequiredError();
  if (!response.ok) throw new Error('signage_schedule_failed');
  return (await response.json()) as unknown;
}
export const loadSignageSchedule = async (
  siteId: string,
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<SignageScheduleResponse> =>
  signageScheduleResponseSchema.parse(
    await signageRequest(
      `/api/sites/${siteId}/signage-schedule`,
      baseUrl,
      undefined,
      fetcher,
    ),
  );
export const createSignType = async (
  siteId: string,
  name: string,
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<SignType> =>
  signTypeSchema.parse(
    await signageRequest(
      `/api/sites/${siteId}/sign-types`,
      baseUrl,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      },
      fetcher,
    ),
  );
export const updateSignType = async (
  siteId: string,
  type: SignType,
  name: string,
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<SignType> =>
  signTypeSchema.parse(
    await signageRequest(
      `/api/sites/${siteId}/sign-types/${type.id}`,
      baseUrl,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, expectedUpdatedAt: type.updatedAt }),
      },
      fetcher,
    ),
  );
export const createSign = async (
  siteId: string,
  typeId: string,
  code: string,
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<Sign> =>
  signSchema.parse(
    await signageRequest(
      `/api/sites/${siteId}/sign-types/${typeId}/signs`,
      baseUrl,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          code,
          quantity: 1,
          location: '',
          content: '',
          comments: '',
          status: 'UNSPECIFIED',
        }),
      },
      fetcher,
    ),
  );
export const updateSign = async (
  siteId: string,
  sign: Sign,
  field: 'code' | 'quantity' | 'location' | 'content' | 'comments' | 'status',
  value: string | number,
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<Sign> =>
  signSchema.parse(
    await signageRequest(
      `/api/sites/${siteId}/signs/${sign.id}`,
      baseUrl,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          field,
          value,
          expectedUpdatedAt: sign.updatedAt,
        }),
      },
      fetcher,
    ),
  );

export class OnboardingSessionExpiredError extends Error {
  readonly code = 'onboarding_session_expired';
}

export class DashboardAuthenticationRequiredError extends Error {
  readonly code = 'dashboard_authentication_required';
}

export class LoginAuthenticationError extends Error {
  readonly code = 'authentication_failed';
}

export class PasswordResetRejectedError extends Error {
  readonly code = 'password_reset_rejected';
}

export type SiteCreateErrorCode =
  | 'sites_forbidden'
  | 'sites_upgrade_required'
  | 'sites_paid_seat_required'
  | 'sites_conflict'
  | 'sites_unavailable';

export class SiteCreateError extends Error {
  constructor(readonly code: SiteCreateErrorCode) {
    super(code);
  }
}

export async function loadSites(
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<SitesPageResponse> {
  const response = await fetcher(`${baseUrl}/api/sites`, {
    credentials: 'include',
  });
  if (response.status === 401) throw new DashboardAuthenticationRequiredError();
  if (!response.ok) throw new Error('sites_load_failed');
  return sitesPageResponseSchema.parse(await response.json());
}

export async function createSite(
  input: CreateSiteRequest,
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<CreateSiteResponse> {
  const response = await fetcher(`${baseUrl}/api/sites`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (response.status === 401) throw new DashboardAuthenticationRequiredError();
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    const code = [
      'sites_forbidden',
      'sites_upgrade_required',
      'sites_paid_seat_required',
      'sites_conflict',
    ].includes(error.error ?? '')
      ? (error.error as SiteCreateErrorCode)
      : 'sites_unavailable';
    throw new SiteCreateError(code);
  }
  return createSiteResponseSchema.parse(await response.json());
}

export async function loadSiteActivity(
  siteId: string,
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<SiteActivityResponse> {
  const response = await fetcher(`${baseUrl}/api/sites/${siteId}`, {
    credentials: 'include',
  });
  if (response.status === 401) throw new DashboardAuthenticationRequiredError();
  if (!response.ok) throw new Error('site_activity_load_failed');
  return siteActivityResponseSchema.parse(await response.json());
}

export async function loadSiteActivityPage(
  siteId: string,
  cursor: string | null,
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<SiteActivityPageResponse> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const response = await fetcher(
    `${baseUrl}/api/sites/${siteId}/activity${query}`,
    { credentials: 'include' },
  );
  if (response.status === 401) throw new DashboardAuthenticationRequiredError();
  if (response.status === 404) throw new SiteActivityDisabledError();
  if (!response.ok) throw new Error('site_activity_feed_load_failed');
  return siteActivityPageResponseSchema.parse(await response.json());
}

export class SiteActivityDisabledError extends Error {}
export class SiteActivityNotFoundError extends Error {}

export async function createSiteComment(
  siteId: string,
  text: string,
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<SiteActivityItem> {
  const response = await fetcher(`${baseUrl}/api/sites/${siteId}/comments`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (response.status === 401) throw new DashboardAuthenticationRequiredError();
  if (response.status === 404) throw new SiteActivityNotFoundError();
  if (!response.ok) throw new Error('site_comment_create_failed');
  return siteActivityItemSchema.parse(await response.json());
}

export async function loadAllocationPlans(
  siteId: string,
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<AllocationPlansResponse> {
  const response = await fetcher(
    `${baseUrl}/api/sites/${siteId}/allocation-plans`,
    {
      credentials: 'include',
    },
  );
  if (response.status === 401) throw new DashboardAuthenticationRequiredError();
  if (response.status === 404) return { canAddPlans: false, plans: [] };
  if (!response.ok) throw new Error('allocation_plans_load_failed');
  return allocationPlansResponseSchema.parse(await response.json());
}

export async function loadAllocationPlanContent(
  siteId: string,
  planId: string,
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<Blob> {
  const response = await fetcher(
    `${baseUrl}/api/sites/${siteId}/allocation-plans/${planId}/content`,
    { credentials: 'include' },
  );
  if (response.status === 401) throw new DashboardAuthenticationRequiredError();
  if (!response.ok) throw new Error('allocation_plan_preview_failed');
  return response.blob();
}

export async function createAllocationPlanUploadBatch(
  siteId: string,
  input: CreateAllocationPlanUploadBatchRequest,
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<CreateAllocationPlanUploadBatchResponse> {
  const response = await fetcher(
    `${baseUrl}/api/sites/${siteId}/allocation-plan-upload-batches`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  if (response.status === 401) throw new DashboardAuthenticationRequiredError();
  if (!response.ok) throw new Error('allocation_plan_intent_failed');
  return createAllocationPlanUploadBatchResponseSchema.parse(
    await response.json(),
  );
}

export async function uploadAllocationPlan(
  uploadUrl: string,
  file: File,
  headers: Record<string, string>,
  fetcher: typeof fetch = fetch,
  options?: { onProgress: (percentage: number) => void; signal: AbortSignal },
): Promise<void> {
  if (options) {
    await new Promise<void>((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('PUT', uploadUrl);
      for (const [name, value] of Object.entries(headers))
        request.setRequestHeader(name, value);
      request.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable)
          options.onProgress(Math.round((event.loaded / event.total) * 100));
      });
      request.addEventListener('load', () => {
        if (request.status >= 200 && request.status < 300) resolve();
        else reject(new Error('allocation_plan_upload_failed'));
      });
      request.addEventListener('error', () => {
        reject(new Error('allocation_plan_upload_failed'));
      });
      request.addEventListener('abort', () => {
        reject(new Error('allocation_plan_upload_cancelled'));
      });
      options.signal.addEventListener(
        'abort',
        () => {
          request.abort();
        },
        { once: true },
      );
      request.send(file);
    });
    return;
  }
  const response = await fetcher(uploadUrl, {
    method: 'PUT',
    headers,
    body: file,
  });
  if (!response.ok) throw new Error('allocation_plan_upload_failed');
}

export async function finalizeAllocationPlanUpload(
  siteId: string,
  uploadId: string,
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<FinalizeAllocationPlanUploadResponse> {
  const response = await fetcher(
    `${baseUrl}/api/sites/${siteId}/allocation-plan-uploads/${uploadId}/finalize`,
    { method: 'POST', credentials: 'include' },
  );
  if (response.status === 401) throw new DashboardAuthenticationRequiredError();
  if (!response.ok) throw new Error('allocation_plan_finalize_failed');
  return finalizeAllocationPlanUploadResponseSchema.parse(
    await response.json(),
  );
}

export async function requestPasswordRecovery(
  input: PasswordRecoveryRequest,
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<PasswordRecoveryRequestResponse> {
  const response = await fetcher(
    `${baseUrl}/api/auth/password-recovery/request`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) throw new Error('password_recovery_unavailable');
  return passwordRecoveryRequestResponseSchema.parse(await response.json());
}

export async function resetPassword(
  input: PasswordResetRequest,
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<PasswordResetResponse> {
  const response = await fetcher(
    `${baseUrl}/api/auth/password-recovery/reset`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  if (response.status === 400) throw new PasswordResetRejectedError();
  if (!response.ok) throw new Error('password_reset_unavailable');
  return passwordResetResponseSchema.parse(await response.json());
}

export async function login(
  input: LoginRequest,
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<LoginResponse> {
  const response = await fetcher(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (response.status === 401) throw new LoginAuthenticationError();
  if (!response.ok) throw new Error('login_unavailable');
  return loginResponseSchema.parse(await response.json());
}

export async function loadDashboard(
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<DashboardResponse> {
  const response = await fetcher(`${baseUrl}/api/dashboard`, {
    credentials: 'include',
  });
  if (response.status === 401) throw new DashboardAuthenticationRequiredError();
  if (!response.ok) throw new Error('dashboard_load_failed');
  return dashboardResponseSchema.parse(await response.json());
}

export async function logoutDashboard(
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const response = await fetcher(`${baseUrl}/api/dashboard/logout`, {
    method: 'POST',
    credentials: 'include',
  });
  if (response.status !== 204) throw new Error('dashboard_logout_failed');
}

export async function loadDiscovery(
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<DiscoveryPageResponse> {
  const response = await fetcher(`${baseUrl}/api/onboarding/discovery`, {
    credentials: 'include',
  });
  if (response.status === 401) throw new OnboardingSessionExpiredError();
  if (!response.ok) throw new Error('discovery_load_failed');
  return discoveryPageResponseSchema.parse(await response.json());
}

export async function completeDiscovery(
  input: DiscoveryRequest,
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<DiscoveryResponse> {
  const response = await fetcher(`${baseUrl}/api/onboarding/discovery`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      'x-hansel-csrf': readCsrfProof(new OnboardingSessionExpiredError()),
    },
    body: JSON.stringify(input),
  });
  if (response.status === 401) throw new OnboardingSessionExpiredError();
  if (!response.ok) throw new Error('discovery_failed');
  return discoveryResponseSchema.parse(await response.json());
}

export async function loadPersonalProfile(
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<PersonalProfilePageResponse> {
  const response = await fetcher(`${baseUrl}/api/onboarding/personal-profile`, {
    method: 'GET',
    credentials: 'include',
  });
  if (response.status === 401) throw new OnboardingSessionExpiredError();
  if (!response.ok) throw new Error('personal_profile_load_failed');
  return personalProfilePageResponseSchema.parse(await response.json());
}

export async function loadOrganizationProfile(
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<OrganizationProfilePageResponse> {
  const response = await fetcher(
    `${baseUrl}/api/onboarding/organization-profile`,
    {
      credentials: 'include',
    },
  );
  if (!response.ok) throw new Error('organization_profile_load_failed');
  return organizationProfilePageResponseSchema.parse(await response.json());
}

export async function submitOrganizationProfile(
  input: OrganizationProfileRequest,
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<OrganizationProfileResponse> {
  const response = await fetcher(
    `${baseUrl}/api/onboarding/organization-profile`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-hansel-csrf': readCsrfProof(),
      },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) throw new Error('organization_profile_failed');
  return organizationProfileResponseSchema.parse(await response.json());
}

function readCsrfProof(
  missingError: Error = new Error('csrf_proof_missing'),
): string {
  const proof = document.cookie
    .split(';')
    .map((part) => part.trim().split('='))
    .find(([name]) => name === 'hansel_onboarding_csrf')?.[1];
  if (!proof) throw missingError;
  return decodeURIComponent(proof);
}

export async function loadPlanSelection(
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<PlanSelectionPageResponse> {
  const response = await fetcher(`${baseUrl}/api/onboarding/plan-selection`, {
    credentials: 'include',
  });
  if (!response.ok) throw new Error('plan_selection_load_failed');
  return planSelectionPageResponseSchema.parse(await response.json());
}

export async function selectOnboardingPlan(
  priceId: PlanPriceId,
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<PlanSelectionResponse> {
  const response = await fetcher(`${baseUrl}/api/onboarding/plan-selection`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      'x-hansel-csrf': readCsrfProof(),
    },
    body: JSON.stringify({ priceId }),
  });
  if (!response.ok) throw new Error('plan_selection_failed');
  return planSelectionResponseSchema.parse(await response.json());
}

export async function submitPersonalProfile(
  input: PersonalProfileRequest,
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<PersonalProfileResponse> {
  const response = await fetcher(`${baseUrl}/api/onboarding/personal-profile`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      'x-hansel-csrf': readCsrfProof(new OnboardingSessionExpiredError()),
    },
    body: JSON.stringify(input),
  });
  if (response.status === 401) throw new OnboardingSessionExpiredError();
  if (!response.ok) throw new Error('personal_profile_failed');
  return personalProfileResponseSchema.parse(await response.json());
}

export async function getHealth(
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<HealthResponse> {
  const response = await fetcher(`${baseUrl}/api/health`);
  if (!response.ok)
    throw new Error(`Health request failed with ${String(response.status)}`);
  return healthResponseSchema.parse(await response.json());
}

export async function verifyOnboardingEmail(
  input: VerifyOnboardingEmailRequest,
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<VerifyOnboardingEmailResponse> {
  const response = await fetcher(
    `${baseUrl}/api/onboarding/email-verification/verify`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) throw new Error('verification_failed');
  return verifyOnboardingEmailResponseSchema.parse(await response.json());
}

export async function resendOnboardingVerification(
  input: ResendOnboardingVerificationRequest,
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<ResendOnboardingVerificationResponse> {
  const response = await fetcher(
    `${baseUrl}/api/onboarding/email-verification/resend`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) throw new Error('resend_failed');
  return resendOnboardingVerificationResponseSchema.parse(
    await response.json(),
  );
}

export async function createOnboardingAccount(
  input: CreateOnboardingAccountRequest,
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<CreateOnboardingAccountResponse> {
  const response = await fetcher(`${baseUrl}/api/onboarding/accounts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Account request failed with ${String(response.status)}`);
  }
  return createOnboardingAccountResponseSchema.parse(await response.json());
}
