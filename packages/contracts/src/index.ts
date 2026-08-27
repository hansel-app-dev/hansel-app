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

export const jobTitleOptions = [
  { id: 'manager', label: 'Manager' },
  { id: 'facility_manager', label: 'Facility manager' },
  { id: 'project_manager', label: 'Project manager' },
  { id: 'in_house_designer', label: 'In-house designer' },
  {
    id: 'signage_wayfinding_designer',
    label: 'Signage wayfinding designer',
  },
  { id: 'other', label: 'Other' },
] as const;

export const departmentOptions = [
  { id: 'marketing_communications', label: 'Marketing & Communications' },
  {
    id: 'development_advancement',
    label: 'Development / Advancement Office',
  },
  {
    id: 'facilities_management_campus_maintenance',
    label: 'Facilities Management / Campus Maintenance',
  },
  { id: 'other', label: 'Other' },
] as const;

const normalizedProfileText = z
  .string()
  .trim()
  .transform((value) => value.normalize('NFC'))
  .pipe(
    z
      .string()
      .min(1)
      .refine((value) => Array.from(value).length <= 100),
  );
const jobTitleIds = jobTitleOptions.map(({ id }) => id) as [
  (typeof jobTitleOptions)[number]['id'],
  ...(typeof jobTitleOptions)[number]['id'][],
];
const departmentIds = departmentOptions.map(({ id }) => id) as [
  (typeof departmentOptions)[number]['id'],
  ...(typeof departmentOptions)[number]['id'][],
];

export const personalProfileRequestSchema = z
  .object({
    firstName: normalizedProfileText,
    lastName: normalizedProfileText,
    jobTitle: z.enum(jobTitleIds),
    jobTitleOther: normalizedProfileText.optional(),
    department: z.enum(departmentIds),
    departmentOther: normalizedProfileText.optional(),
  })
  .strict()
  .superRefine((profile, context) => {
    const conditionalFields = [
      ['jobTitle', 'jobTitleOther'],
      ['department', 'departmentOther'],
    ] as const;
    for (const [selection, other] of conditionalFields) {
      if ((profile[selection] === 'other') !== Boolean(profile[other])) {
        context.addIssue({
          code: 'custom',
          message: `Invalid ${other}`,
          path: [other],
        });
      }
    }
  });
export type PersonalProfileRequest = z.infer<
  typeof personalProfileRequestSchema
>;

export const personalProfileResponseSchema = z
  .object({ nextStep: z.literal('plan-selection') })
  .strict();
export type PersonalProfileResponse = z.infer<
  typeof personalProfileResponseSchema
>;
