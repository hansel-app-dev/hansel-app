import { z } from 'zod';

export const healthResponseSchema = z.object({ status: z.literal('ok') });
export type HealthResponse = z.infer<typeof healthResponseSchema>;

const passwordSchema = z
  .string()
  .refine((password) => {
    const length = Array.from(password).length;
    return length >= 15 && length <= 128;
  }, 'Password must contain between 15 and 128 Unicode characters')
  .regex(/\p{Lu}/u, 'Password must contain an uppercase letter')
  .regex(/\p{Ll}/u, 'Password must contain a lowercase letter')
  .regex(/\p{N}/u, 'Password must contain a number')
  .regex(/[\p{P}\p{S}]/u, 'Password must contain a special character');

export const createOnboardingAccountRequestSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email()),
    password: passwordSchema,
    acceptsTerms: z.literal(true),
    termsVersion: z.string().trim().min(1).max(100),
    privacyVersion: z.string().trim().min(1).max(100),
  })
  .strict();
export type CreateOnboardingAccountRequest = z.infer<
  typeof createOnboardingAccountRequestSchema
>;

export const createOnboardingAccountResponseSchema = z
  .object({ nextStep: z.literal('verify-email') })
  .strict();
export type CreateOnboardingAccountResponse = z.infer<
  typeof createOnboardingAccountResponseSchema
>;

export const verifyOnboardingEmailRequestSchema = z
  .object({
    email: z.email().trim().toLowerCase(),
    code: z.string().regex(/^\d{6}$/),
  })
  .strict();
export type VerifyOnboardingEmailRequest = z.infer<
  typeof verifyOnboardingEmailRequestSchema
>;

export const verifyOnboardingEmailResponseSchema = z
  .object({ nextStep: z.literal('personal-profile') })
  .strict();
export type VerifyOnboardingEmailResponse = z.infer<
  typeof verifyOnboardingEmailResponseSchema
>;

export const resendOnboardingVerificationRequestSchema = z
  .object({ email: z.string().trim().toLowerCase().pipe(z.email()) })
  .strict();
export type ResendOnboardingVerificationRequest = z.infer<
  typeof resendOnboardingVerificationRequestSchema
>;

export const resendOnboardingVerificationResponseSchema = z
  .object({ status: z.literal('accepted') })
  .strict();
export type ResendOnboardingVerificationResponse = z.infer<
  typeof resendOnboardingVerificationResponseSchema
>;
