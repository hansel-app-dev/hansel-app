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
} from '@hansel/contracts';

export class OnboardingSessionExpiredError extends Error {
  readonly code = 'onboarding_session_expired';
}

export class DashboardAuthenticationRequiredError extends Error {
  readonly code = 'dashboard_authentication_required';
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
