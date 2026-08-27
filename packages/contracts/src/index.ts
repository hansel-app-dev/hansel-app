import { z } from 'zod';
import countries from 'i18n-iso-countries';
import englishCountries from 'i18n-iso-countries/langs/en.json' with { type: 'json' };

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

export const planPriceIds = [
  'free',
  'plus_monthly',
  'plus_annual',
  'pro_monthly',
  'pro_annual',
  'enterprise',
] as const;
export const planPriceIdSchema = z.enum(planPriceIds);
export type PlanPriceId = z.infer<typeof planPriceIdSchema>;
export const billingIntervalSchema = z.enum(['monthly', 'annual']);
export type BillingInterval = z.infer<typeof billingIntervalSchema>;

export const planSelectionRequestSchema = z
  .object({ priceId: planPriceIdSchema })
  .strict();
export type PlanSelectionRequest = z.infer<typeof planSelectionRequestSchema>;

export const planSelectionResponseSchema = z.discriminatedUnion('nextStep', [
  z.object({ nextStep: z.literal('payment') }).strict(),
  z.object({ nextStep: z.literal('organization-profile') }).strict(),
  z
    .object({
      nextStep: z.literal('contact-sales'),
      destination: z.url().startsWith('https://'),
    })
    .strict(),
]);
export type PlanSelectionResponse = z.infer<typeof planSelectionResponseSchema>;

export const planDisplayEntrySchema = z
  .object({
    priceId: planPriceIdSchema,
    planId: z.enum(['free', 'plus', 'pro', 'enterprise']),
    displayName: z.string().min(1),
    description: z.string().min(1),
    features: z.array(z.string().min(1)).length(3),
    billingInterval: billingIntervalSchema.nullable(),
    currency: z.literal('USD'),
    amountMinor: z.number().int().nonnegative().nullable(),
    monthlyEquivalentMinor: z.number().int().nonnegative().nullable(),
    additionalSiteAmountMinor: z.number().int().nonnegative().nullable(),
    paymentRequired: z.boolean(),
    maximumSites: z.number().int().positive().nullable(),
    contactSales: z.boolean(),
  })
  .strict();
export type PlanDisplayEntry = z.infer<typeof planDisplayEntrySchema>;

export const planSelectionPageResponseSchema = z
  .object({
    firstName: z.string().min(1).max(100),
    selectedInterval: billingIntervalSchema,
    selectedPriceId: planPriceIdSchema.nullable(),
    plans: z.array(planDisplayEntrySchema).length(6),
  })
  .strict();
export type PlanSelectionPageResponse = z.infer<
  typeof planSelectionPageResponseSchema
>;

countries.registerLocale(englishCountries);
export const countryOptions = Object.entries(
  countries.getNames('en', { select: 'official' }),
)
  .filter(([id]) => id !== 'XK')
  .map(([id, label]) => ({ id, label }))
  .sort((left, right) => left.label.localeCompare(right.label));

export const industryOptions = [
  { id: 'healthcare', label: 'Healthcare' },
  { id: 'education', label: 'Education' },
  { id: 'retail', label: 'Retail' },
  { id: 'corporate_commercial', label: 'Corporate / Commercial' },
  { id: 'transport_infrastructure', label: 'Transport & Infrastructure' },
  { id: 'government_civic', label: 'Government & Civic' },
  { id: 'construction_industrial', label: 'Construction & Industrial' },
  { id: 'hospitality_tourism', label: 'Hospitality & Tourism' },
  { id: 'sports_entertainment', label: 'Sports & Entertainment' },
  { id: 'exhibitions_events', label: 'Exhibitions & Events' },
] as const;

export const placeServiceOptions = {
  healthcare: [
    { id: 'hospitals', label: 'Hospitals' },
    { id: 'clinics', label: 'Clinics' },
    { id: 'aged_care_facilities', label: 'Aged care facilities' },
  ],
  education: [{ id: 'universities_schools', label: 'University/Schools' }],
  retail: [
    { id: 'shopping_malls', label: 'Shopping malls' },
    { id: 'department_stores', label: 'Department stores' },
    { id: 'retail_stores', label: 'Retail store' },
  ],
  corporate_commercial: [
    { id: 'office_buildings', label: 'Office buildings' },
    { id: 'coworking_spaces', label: 'Co-working spaces' },
    { id: 'business_parks', label: 'Business parks' },
    { id: 'headquarters', label: 'Headquarters' },
  ],
  transport_infrastructure: [
    { id: 'airports', label: 'Airports' },
    { id: 'train_metro_bus_ferry', label: 'Train/Metro/Bus/Ferry' },
    { id: 'parking_structures', label: 'Parking structures' },
  ],
  government_civic: [
    { id: 'council_buildings', label: 'Council buildings' },
    { id: 'public_libraries', label: 'Public libraries' },
    { id: 'community_centers', label: 'Community centers' },
    { id: 'courthouses', label: 'Courthouses' },
    { id: 'licensing_service_centers', label: 'Licensing or service centers' },
    { id: 'community_halls', label: 'Community halls' },
  ],
  construction_industrial: [
    { id: 'construction_sites', label: 'Construction sites' },
    { id: 'warehouses', label: 'Warehouses' },
    { id: 'manufacturing_plants', label: 'Manufacturing plants' },
    { id: 'logistics_hubs', label: 'Logistics hubs' },
    { id: 'mining_operations', label: 'Mining operations' },
  ],
  hospitality_tourism: [
    { id: 'hotels_resorts', label: 'Hotels and resorts' },
    { id: 'hostels_lodges', label: 'Hostels and lodges' },
    { id: 'museums_galleries', label: 'Museums and galleries' },
    { id: 'tourist_attractions', label: 'Tourist attractions' },
    { id: 'information_centers', label: 'Information centers' },
  ],
  sports_entertainment: [
    { id: 'stadiums_arenas', label: 'Stadiums and arenas' },
    { id: 'convention_centers', label: 'Convention centers' },
    { id: 'amusement_parks', label: 'Amusement parks' },
  ],
  exhibitions_events: [
    { id: 'exhibitions', label: 'Exhibitions' },
    { id: 'trade_shows_conferences', label: 'Trade shows/Conferences' },
  ],
} as const;

export const organizationSizeOptions = [
  { id: 'employees_1_10', label: '1–10' },
  { id: 'employees_11_50', label: '11–50' },
  { id: 'employees_51_100', label: '51–100' },
  { id: 'employees_over_100', label: 'More than 100' },
] as const;

const organizationNameSchema = z
  .string()
  .trim()
  .transform((value) => value.normalize('NFC'))
  .pipe(
    z
      .string()
      .min(1)
      .refine((value) => Array.from(value).length <= 200),
  );
const countryIds = countryOptions.map(({ id }) => id) as [string, ...string[]];
const industryIds = industryOptions.map(({ id }) => id) as [
  (typeof industryOptions)[number]['id'],
  ...(typeof industryOptions)[number]['id'][],
];
const sizeIds = organizationSizeOptions.map(({ id }) => id) as [
  (typeof organizationSizeOptions)[number]['id'],
  ...(typeof organizationSizeOptions)[number]['id'][],
];
const allPlaceIds = Object.values(placeServiceOptions)
  .flat()
  .map(({ id }) => id) as [string, ...string[]];

export const organizationProfileRequestSchema = z
  .object({
    organizationName: organizationNameSchema,
    country: z.enum(countryIds),
    industry: z.enum(industryIds),
    placeService: z.enum(allPlaceIds),
    organizationSize: z.enum(sizeIds),
    submissionKey: z.string().min(32).max(200),
  })
  .strict()
  .superRefine((input, context) => {
    const permitted = placeServiceOptions[input.industry].some(
      ({ id }) => id === input.placeService,
    );
    if (!permitted)
      context.addIssue({
        code: 'custom',
        path: ['placeService'],
        message: 'Place or service does not belong to industry',
      });
  });
export type OrganizationProfileRequest = z.infer<
  typeof organizationProfileRequestSchema
>;

const optionSchema = z
  .object({ id: z.string().min(1), label: z.string().min(1) })
  .strict();
export const organizationProfilePageResponseSchema = z
  .object({
    submissionKey: z.string().min(32).max(200),
    countries: z.array(optionSchema).length(249),
    industries: z.array(optionSchema).length(industryOptions.length),
    placesByIndustry: z.record(z.string(), z.array(optionSchema).min(1)),
    sizes: z.array(optionSchema).length(organizationSizeOptions.length),
  })
  .strict();
export type OrganizationProfilePageResponse = z.infer<
  typeof organizationProfilePageResponseSchema
>;
export const organizationProfileResponseSchema = z
  .object({ nextStep: z.literal('discovery') })
  .strict();
export type OrganizationProfileResponse = z.infer<
  typeof organizationProfileResponseSchema
>;
