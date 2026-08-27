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
} from '@hansel/contracts';

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
