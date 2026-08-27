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
  type PersonalProfileRequest,
  type PersonalProfileResponse,
  planSelectionPageResponseSchema,
  planSelectionResponseSchema,
  type PlanPriceId,
  type PlanSelectionPageResponse,
  type PlanSelectionResponse,
} from '@hansel/contracts';

function readCsrfProof(): string {
  const proof = document.cookie
    .split(';')
    .map((part) => part.trim().split('='))
    .find(([name]) => name === 'hansel_onboarding_csrf')?.[1];
  if (!proof) throw new Error('csrf_proof_missing');
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
      'x-hansel-csrf': readCsrfProof(),
    },
    body: JSON.stringify(input),
  });
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
