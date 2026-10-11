import { z } from 'zod';
export * from './plan-signs.js';
import countries from 'i18n-iso-countries';
import englishCountries from 'i18n-iso-countries/langs/en.json' with { type: 'json' };

export const healthResponseSchema = z.object({ status: z.literal('ok') });
/** @spec microsoft-local-auth REQ-009 */
export const externalAuthenticationFailureMessage =
  "We couldn't sign you in with this provider. Use the sign-in method you used to create your account. If you signed up with email and password, use those details below—linking Google or Microsoft to an existing account isn't supported yet. New to Hansel? Choose Create an account.";
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const loginRequestSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email()),
    password: z.string().min(1).max(128),
  })
  .strict();
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const loginDestinationSchema = z.enum([
  '/dashboard',
  '/onboarding/verify-email',
  '/onboarding/about-you',
  '/onboarding/plan-selection',
  '/onboarding/payment',
  '/onboarding/organization-profile',
  '/onboarding/discovery',
]);
export type LoginDestination = z.infer<typeof loginDestinationSchema>;

export const loginResponseSchema = z
  .object({ destination: loginDestinationSchema })
  .strict();
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const passwordRecoveryRequestSchema = z
  .object({ email: z.string().trim().toLowerCase().pipe(z.email()) })
  .strict();
export type PasswordRecoveryRequest = z.infer<
  typeof passwordRecoveryRequestSchema
>;

export const passwordRecoveryRequestResponseSchema = z
  .object({ status: z.literal('accepted') })
  .strict();
export type PasswordRecoveryRequestResponse = z.infer<
  typeof passwordRecoveryRequestResponseSchema
>;

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

export const passwordResetRequestSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email()),
    code: z.string().regex(/^\d{6}$/),
    password: passwordSchema,
  })
  .strict();
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;

export const passwordResetResponseSchema = z
  .object({ destination: z.literal('/login') })
  .strict();
export type PasswordResetResponse = z.infer<typeof passwordResetResponseSchema>;

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
  .object({ nextStep: z.enum(['verify-email', 'login']) })
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
  .object({
    nextStep: z.literal('personal-profile'),
  })
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

export const personalProfilePageResponseSchema = z
  .object({ profile: personalProfileRequestSchema.nullable() })
  .strict();
export type PersonalProfilePageResponse = z.infer<
  typeof personalProfilePageResponseSchema
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

export const organizationProfileValuesSchema = z
  .object({
    organizationName: organizationNameSchema,
    country: z.enum(countryIds),
    industry: z.enum(industryIds),
    placeService: z.enum(allPlaceIds),
    organizationSize: z.enum(sizeIds),
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
export const organizationProfileRequestSchema =
  organizationProfileValuesSchema.safeExtend({
    submissionKey: z.string().min(32).max(200),
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
    profile: organizationProfileValuesSchema.optional(),
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

export const discoveryManagementOptions = [
  { id: 'pdf', label: 'PDF' },
  { id: 'spreadsheet', label: 'Spreadsheet' },
  { id: 'other', label: 'Other' },
] as const;
const discoveryManagementIds = discoveryManagementOptions.map(
  ({ id }) => id,
) as [
  (typeof discoveryManagementOptions)[number]['id'],
  ...(typeof discoveryManagementOptions)[number]['id'][],
];
const normalizedDiscoveryText = (maximum: number) =>
  z
    .string()
    .trim()
    .transform((value) => value.normalize('NFC'))
    .pipe(
      z
        .string()
        .min(1)
        .refine((value) => Array.from(value).length <= maximum),
    );
const optionalChallengesSchema = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  normalizedDiscoveryText(1_000).optional(),
);
const discoverySubmitRequestSchema = z
  .object({
    action: z.literal('submit'),
    currentManagement: z.enum(discoveryManagementIds),
    currentManagementOther: normalizedDiscoveryText(100).optional(),
    challenges: optionalChallengesSchema,
    submissionKey: z.string().min(32).max(200),
  })
  .strict()
  .superRefine((input, context) => {
    if (
      (input.currentManagement === 'other') !==
      Boolean(input.currentManagementOther)
    )
      context.addIssue({
        code: 'custom',
        message: 'Invalid currentManagementOther',
        path: ['currentManagementOther'],
      });
  })
  .transform(({ challenges, ...input }) =>
    challenges === undefined ? input : { ...input, challenges },
  );
const discoverySkipRequestSchema = z
  .object({
    action: z.literal('skip'),
    submissionKey: z.string().min(32).max(200),
  })
  .strict();
export const discoveryRequestSchema = z.discriminatedUnion('action', [
  discoverySubmitRequestSchema,
  discoverySkipRequestSchema,
]);
export type DiscoveryRequest = z.infer<typeof discoveryRequestSchema>;

export const discoveryPageResponseSchema = z
  .object({
    submissionKey: z.string().min(32).max(200),
    methods: z.array(optionSchema).length(discoveryManagementOptions.length),
  })
  .strict();
export type DiscoveryPageResponse = z.infer<typeof discoveryPageResponseSchema>;

export const discoveryResponseSchema = z
  .object({
    nextStep: z.literal('dashboard'),
    destination: z.literal('/dashboard'),
  })
  .strict();
export type DiscoveryResponse = z.infer<typeof discoveryResponseSchema>;

export const dashboardResponseSchema = z
  .object({
    siteCount: z.number().int().nonnegative().optional(),
    viewer: z
      .object({
        displayName: z.string().min(1).max(201),
        initials: z
          .string()
          .min(1)
          .refine((value) => Array.from(value).length <= 2),
        roleLabel: z.string().min(1).max(100),
        email: z.email().max(254).optional(),
      })
      .strict(),
    organization: z
      .object({
        name: z.string().min(1).max(200),
        planDisplayName: z.string().min(1).max(100),
      })
      .strict()
      .optional(),
  })
  .strict();
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;

export const siteRoleSchema = z.enum(['ADMINISTRATOR', 'EDITOR', 'VIEWER']);
export type SiteRole = z.infer<typeof siteRoleSchema>;

export const siteOrganizationAccessSchema = z.enum([
  'VIEW_COMMENT',
  'EDIT_MANAGE',
]);
export type SiteOrganizationAccess = z.infer<
  typeof siteOrganizationAccessSchema
>;

export const siteAccessScopeSchema = z.enum([
  'ORGANIZATION',
  'PEOPLE_INVITED',
  'PRIVATE',
]);
export type SiteAccessScope = z.infer<typeof siteAccessScopeSchema>;

const siteNameSchema = z
  .string()
  .trim()
  .transform((value) => value.normalize('NFC'))
  .pipe(
    z
      .string()
      .min(1)
      .refine((value) => Array.from(value).length <= 100),
  );

export const siteAssignmentSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email()),
    role: siteRoleSchema,
  })
  .strict();
export type SiteAssignment = z.infer<typeof siteAssignmentSchema>;

const createSiteBaseSchema = z
  .object({
    name: siteNameSchema,
    idempotencyKey: z.string().min(32).max(200),
  })
  .strict();

export const createSiteRequestSchema = z.discriminatedUnion('accessScope', [
  createSiteBaseSchema.extend({
    accessScope: z.literal('ORGANIZATION'),
    organizationAccess: siteOrganizationAccessSchema,
  }),
  createSiteBaseSchema.extend({
    accessScope: z.literal('PEOPLE_INVITED'),
    assignments: z.array(siteAssignmentSchema).min(1).max(100),
  }),
  createSiteBaseSchema.extend({ accessScope: z.literal('PRIVATE') }),
]);
export type CreateSiteRequest = z.infer<typeof createSiteRequestSchema>;

/** Temporary compatibility schema for the bounded site-access-scope rollout window. */
export const legacyCreateSiteRequestSchema = createSiteBaseSchema.extend({
  organizationAccess: siteOrganizationAccessSchema,
  assignments: z.array(siteAssignmentSchema).max(100),
});
export type LegacyCreateSiteRequest = z.infer<
  typeof legacyCreateSiteRequestSchema
>;

export const createSiteResponseSchema = z
  .object({
    siteId: z.uuid(),
    destination: z.string().regex(/^\/sites\/[0-9a-f-]{36}\/activity$/),
  })
  .strict();
export type CreateSiteResponse = z.infer<typeof createSiteResponseSchema>;

export const siteMemberChoiceSchema = z
  .object({
    email: z.email(),
    displayName: z.string().min(1).max(201),
    initials: z
      .string()
      .min(1)
      .refine((value) => Array.from(value).length <= 2),
  })
  .strict();
export type SiteMemberChoice = z.infer<typeof siteMemberChoiceSchema>;

export const siteMemberPreviewSchema = z
  .object({
    displayName: z.string().min(1).max(201),
    initials: z
      .string()
      .min(1)
      .refine((value) => Array.from(value).length <= 2),
  })
  .strict();
export type SiteMemberPreview = z.infer<typeof siteMemberPreviewSchema>;

export const siteIdentitySchema = z
  .object({ id: z.uuid(), name: siteNameSchema })
  .strict();
export type SiteIdentity = z.infer<typeof siteIdentitySchema>;

export const siteSummarySchema = siteIdentitySchema
  .extend({
    isOwnedByCurrentMembership: z.boolean().optional(),
    hasCoverImage: z.boolean().optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    memberCount: z.number().int().nonnegative(),
    memberPreview: z.array(siteMemberPreviewSchema).max(3),
  })
  .strict()
  .refine(
    ({ memberCount, memberPreview }) => memberCount >= memberPreview.length,
  );
export type SiteSummary = z.infer<typeof siteSummarySchema>;

export const sitesPageResponseSchema = z
  .object({
    siteCoverImageEnabled: z.boolean().optional(),
    organizationName: z.string().min(1).max(200),
    canCreateSite: z.boolean(),
    canInviteMembers: z.boolean(),
    creator: siteMemberChoiceSchema,
    siteLimitReached: z.boolean(),
    maximumSites: z.number().int().positive().nullable(),
    members: z.array(siteMemberChoiceSchema).max(1_000),
    sites: z.array(siteSummarySchema).max(10_000),
  })
  .strict();
export type SitesPageResponse = z.infer<typeof sitesPageResponseSchema>;

export const siteActivityResponseSchema = z
  .object({ site: siteIdentitySchema })
  .strict();
export type SiteActivityResponse = z.infer<typeof siteActivityResponseSchema>;

export const siteActivityKindSchema = z.enum([
  'SITE_CREATED',
  'ALLOCATION_PLAN_ADDED',
  'SIGN_TYPE_CREATED',
  'SIGN_TYPE_RENAMED',
  'SIGN_CREATED',
  'SIGN_UPDATED',
  'SITE_COMMENT_ADDED',
]);
export type SiteActivityKind = z.infer<typeof siteActivityKindSchema>;
const siteActivityActorSchema = siteMemberPreviewSchema;
const siteActivityBase = z.object({
  id: z.uuid(),
  actor: siteActivityActorSchema,
  createdAt: z.iso.datetime(),
});
const subjectActivityKinds = siteActivityKindSchema.exclude([
  'SITE_COMMENT_ADDED',
]);
export const siteActivityItemSchema = z.discriminatedUnion('kind', [
  siteActivityBase
    .extend({
      kind: subjectActivityKinds,
      subjectLabel: z.string().min(1).max(255),
    })
    .strict(),
  siteActivityBase
    .extend({
      kind: z.literal('SITE_COMMENT_ADDED'),
      commentText: z.string().min(1).max(2_000),
    })
    .strict(),
]);
export type SiteActivityItem = z.infer<typeof siteActivityItemSchema>;
export const siteActivityPageResponseSchema = z
  .object({
    items: z.array(siteActivityItemSchema).max(50),
    nextCursor: z.string().min(1).max(512).nullable(),
  })
  .strict();
export type SiteActivityPageResponse = z.infer<
  typeof siteActivityPageResponseSchema
>;
export const createSiteCommentRequestSchema = z
  .object({
    text: z
      .string()
      .trim()
      .transform((value) => value.normalize('NFC'))
      .pipe(
        z
          .string()
          .min(1)
          .refine((value) => Array.from(value).length <= 2_000),
      ),
  })
  .strict();
export type CreateSiteCommentRequest = z.infer<
  typeof createSiteCommentRequestSchema
>;

export const allocationPlanMediaTypeSchema = z.enum([
  'image/png',
  'image/jpeg',
  'application/pdf',
]);
export type AllocationPlanMediaType = z.infer<
  typeof allocationPlanMediaTypeSchema
>;

export const allocationPlanSchema = z
  .object({
    id: z.uuid(),
    name: z.string().min(1).max(400).optional(),
    files: z
      .array(
        z
          .object({
            id: z.uuid(),
            filename: z.string().min(1).max(255),
            mediaType: allocationPlanMediaTypeSchema,
            byteSize: z.number().int().min(1).max(5_242_880),
          })
          .strict(),
      )
      .min(1)
      .max(20)
      .optional(),
    filename: z.string().min(1).max(255).optional(),
    mediaType: allocationPlanMediaTypeSchema.optional(),
    byteSize: z.number().int().min(1).max(5_242_880).optional(),
    createdAt: z.iso.datetime(),
    modifiedAt: z.iso.datetime(),
    uploadedBy: z.string().min(1).max(201),
  })
  .strict()
  .refine(
    (plan) =>
      Boolean(plan.name && plan.files?.length) ||
      Boolean(plan.filename && plan.mediaType && plan.byteSize),
    'A plan must include named files or legacy single-file metadata.',
  );
export type AllocationPlan = z.infer<typeof allocationPlanSchema>;

export const allocationPlansResponseSchema = z
  .object({
    canAddPlans: z.boolean(),
    plans: z.array(allocationPlanSchema).max(10_000),
  })
  .strict();
export type AllocationPlansResponse = z.infer<
  typeof allocationPlansResponseSchema
>;

export const allocationPlanUploadFileSchema = z
  .object({
    filename: z.string().trim().min(1).max(255),
    mediaType: allocationPlanMediaTypeSchema,
    byteSize: z.number().int().min(1).max(5_242_880),
    checksumSha256: z.string().regex(/^[A-Za-z0-9+/]{43}=$/),
  })
  .strict();

export const createAllocationPlanUploadBatchRequestSchema = z
  .object({
    idempotencyKey: z.string().min(32).max(200),
    files: z.array(allocationPlanUploadFileSchema).min(1).max(20),
  })
  .strict();
export type CreateAllocationPlanUploadBatchRequest = z.infer<
  typeof createAllocationPlanUploadBatchRequestSchema
>;

export const allocationPlanUploadIntentSchema = z
  .object({
    uploadId: z.uuid(),
    uploadUrl: z.url().refine((value) => value.startsWith('https://')),
    expiresAt: z.iso.datetime(),
    headers: z
      .object({
        'content-type': allocationPlanMediaTypeSchema,
        'x-amz-checksum-sha256': z.string().regex(/^[A-Za-z0-9+/]{43}=$/),
      })
      .strict(),
  })
  .strict();

export const createAllocationPlanUploadBatchResponseSchema = z
  .object({ uploads: z.array(allocationPlanUploadIntentSchema).min(1).max(20) })
  .strict();
export type CreateAllocationPlanUploadBatchResponse = z.infer<
  typeof createAllocationPlanUploadBatchResponseSchema
>;

export const finalizeAllocationPlanUploadResponseSchema = z
  .object({ plan: allocationPlanSchema })
  .strict();
export type FinalizeAllocationPlanUploadResponse = z.infer<
  typeof finalizeAllocationPlanUploadResponseSchema
>;

export * from './allocation-plan-drafts.js';

const signageText = (maximum: number) =>
  z
    .string()
    .trim()
    .transform((value) => value.normalize('NFC'))
    .pipe(z.string().refine((value) => Array.from(value).length <= maximum));
export const signTypeColorSchema = z.enum(['SLATE', 'RED', 'TEAL']);
export const signSchema = z
  .object({
    id: z.uuid(),
    signTypeId: z.uuid(),
    code: signageText(40).pipe(z.string().min(1)),
    quantity: z.number().int().min(1).max(9_999),
    location: signageText(200),
    content: signageText(200),
    comments: signageText(1_000),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export type Sign = z.infer<typeof signSchema>;
export const signTypeSchema = z
  .object({
    id: z.uuid(),
    name: signageText(80).pipe(z.string().min(1)),
    color: signTypeColorSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    quantityTotal: z.number().int().nonnegative(),
    signs: z.array(signSchema).max(5_000),
  })
  .strict();
export type SignType = z.infer<typeof signTypeSchema>;
export const signageScheduleResponseSchema = z
  .object({
    canManageSigns: z.boolean(),
    signTypes: z.array(signTypeSchema).max(100),
  })
  .strict();
export type SignageScheduleResponse = z.infer<
  typeof signageScheduleResponseSchema
>;
export const createSignTypeRequestSchema = z
  .object({ name: signageText(80).pipe(z.string().min(1)) })
  .strict();
export const updateSignTypeRequestSchema = createSignTypeRequestSchema
  .extend({ expectedUpdatedAt: z.iso.datetime() })
  .strict();
export const signValuesSchema = z
  .object({
    code: signageText(40).pipe(z.string().min(1)),
    quantity: z.number().int().min(1).max(9_999),
    location: signageText(200),
    content: signageText(200),
    comments: signageText(1_000),
  })
  .strict();
export const createSignRequestSchema = signValuesSchema;
const expectedUpdate = { expectedUpdatedAt: z.iso.datetime() };
export const updateSignRequestSchema = z.discriminatedUnion('field', [
  z
    .object({
      field: z.literal('code'),
      value: signageText(40).pipe(z.string().min(1)),
      ...expectedUpdate,
    })
    .strict(),
  z
    .object({
      field: z.literal('quantity'),
      value: z.number().int().min(1).max(9_999),
      ...expectedUpdate,
    })
    .strict(),
  z
    .object({
      field: z.literal('location'),
      value: signageText(200),
      ...expectedUpdate,
    })
    .strict(),
  z
    .object({
      field: z.literal('content'),
      value: signageText(200),
      ...expectedUpdate,
    })
    .strict(),
  z
    .object({
      field: z.literal('comments'),
      value: signageText(1_000),
      ...expectedUpdate,
    })
    .strict(),
]);
export * from './cover-image.js';
export * from './sign-documents.js';
export * from './sign-photos.js';
export * from './sign-comments.js';
export * from './plan-areas.js';

export * from './plan-comments.js';
export * from './library-files.js';
