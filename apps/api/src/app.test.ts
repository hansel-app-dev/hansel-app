import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { VerificationFailedError } from './onboarding/verify-email.js';
import { PersonalProfileTransitionError } from './onboarding/personal-profile.js';
import { PlanSelectionTransitionError } from './onboarding/plan-selection.js';
import { loadPlanCatalog } from './onboarding/plan-catalog.js';
import {
  OrganizationProfileConflictError,
  OrganizationProfileTransitionError,
} from './onboarding/organization-profile.js';
import {
  DiscoveryConflictError,
  DiscoveryTransitionError,
} from './onboarding/discovery.js';
import { PasswordResetRejectedError } from './auth/password-recovery.js';
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
  countryOptions,
  discoveryManagementOptions,
  industryOptions,
  organizationSizeOptions,
  placeServiceOptions,
} from '@hansel/contracts';

const planPage = {
  firstName: 'Nabin',
  selectedInterval: 'annual' as const,
  selectedPriceId: null,
  plans: loadPlanCatalog('test').entries.map(
    ({
      active: _active,
      selfService: _selfService,
      displayOrder: _order,
      stripePriceLookupKey: _key,
      ...plan
    }) => plan,
  ),
};

const app = createApp({ allowedOrigin: 'https://app.example.com' });

describe('site routes [sites-add-new REQ-007..REQ-016]', () => {
  const siteId = 'ad96f8c1-e7f8-4fbb-a057-1c98ee4539a9';
  const page = {
    organizationName: 'Hansel',
    canCreateSite: true,
    canInviteMembers: true,
    creator: {
      email: 'owner@example.com',
      displayName: 'Owner',
      initials: 'O',
    },
    siteLimitReached: false,
    maximumSites: null,
    members: [
      {
        email: 'owner@example.com',
        displayName: 'Owner',
        initials: 'O',
      },
    ],
    sites: [],
  };
  const input = {
    idempotencyKey: 'site-request-00000000000000000001',
    name: 'New site',
    accessScope: 'ORGANIZATION' as const,
    organizationAccess: 'VIEW_COMMENT' as const,
  };
  const create = (overrides = {}) => {
    const sites = {
      load: vi.fn().mockResolvedValue(page),
      create: vi.fn().mockResolvedValue({
        siteId,
        destination: `/sites/${siteId}/activity`,
      }),
      activity: vi.fn().mockResolvedValue({
        site: { id: siteId, name: 'New site' },
      }),
      listAllocationPlans: vi
        .fn()
        .mockResolvedValue({ canAddPlans: true, plans: [] }),
      loadAllocationPlanContent: vi.fn().mockResolvedValue({
        mediaType: 'image/png',
        bytes: new Uint8Array([1, 2, 3]),
      }),
      createAllocationPlanUploadBatch: vi.fn().mockResolvedValue({
        uploads: [
          {
            uploadId: '00000000-0000-4000-8000-000000000005',
            uploadUrl: 'https://uploads.example/plan',
            expiresAt: '2026-09-06T00:15:00.000Z',
            headers: {
              'content-type': 'application/pdf',
              'x-amz-checksum-sha256':
                'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
            },
          },
        ],
      }),
      finalizeAllocationPlanUpload: vi.fn().mockResolvedValue({
        plan: {
          id: '00000000-0000-4000-8000-000000000006',
          filename: 'plan.pdf',
          mediaType: 'application/pdf',
          byteSize: 5,
          createdAt: '2026-09-06T00:00:00.000Z',
          modifiedAt: '2026-09-06T00:00:00.000Z',
          uploadedBy: 'Owner',
        },
      }),
      recordEvent: vi.fn(),
      ...overrides,
    };
    return {
      sites,
      app: createApp(
        {
          allowedOrigin: 'https://app.example.com',
          sitesEnabled: true,
          allocationPlansEnabled: true,
        },
        undefined,
        undefined,
        undefined,
        undefined,
        sites,
      ),
    };
  };

  it('lists, creates, and finalizes Allocation Plan uploads privately [site-allocation-plans-add AC-001]', async () => {
    const fixture = create();
    const cookie = 'hansel_access=access-token';
    await request(fixture.app)
      .get(`/api/sites/${siteId}/allocation-plans`)
      .set('Cookie', cookie)
      .expect(200, { canAddPlans: true, plans: [] });
    await request(fixture.app)
      .post(`/api/sites/${siteId}/allocation-plan-upload-batches`)
      .set('Cookie', cookie)
      .set('Origin', 'https://app.example.com')
      .send({
        idempotencyKey: '12345678901234567890123456789012',
        files: [
          {
            filename: 'plan.pdf',
            mediaType: 'application/pdf',
            byteSize: 5,
            checksumSha256: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
          },
        ],
      })
      .expect(201);
    await request(fixture.app)
      .post(
        `/api/sites/${siteId}/allocation-plan-uploads/00000000-0000-4000-8000-000000000005/finalize`,
      )
      .set('Cookie', cookie)
      .set('Origin', 'https://app.example.com')
      .expect(200);
  });

  it('serves authorized Allocation Plan bytes with private preview headers [site-allocation-plan-preview AC-001, AC-003]', async () => {
    const response = await request(create().app)
      .get(
        `/api/sites/${siteId}/allocation-plans/00000000-0000-4000-8000-000000000006/content`,
      )
      .set('Cookie', 'hansel_access=access-token')
      .expect(200);
    expect(response.headers['content-type']).toMatch(/^image\/png/);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.body).toEqual(Buffer.from([1, 2, 3]));
  });

  it('fails closed across disabled, malformed, unauthenticated, missing, and unavailable previews [site-allocation-plan-preview AC-003]', async () => {
    const planId = '00000000-0000-4000-8000-000000000006';
    const path = `/api/sites/${siteId}/allocation-plans/${planId}/content`;
    const disabled = createApp(
      { allowedOrigin: 'https://app.example.com', sitesEnabled: true },
      undefined,
      undefined,
      undefined,
      undefined,
      create().sites,
    );
    await request(disabled).get(path).expect(404);
    await request(create().app)
      .get(`/api/sites/not-a-uuid/allocation-plans/${planId}/content`)
      .expect(400);
    await request(create().app)
      .get(`/api/sites/${siteId}/allocation-plans/not-a-uuid/content`)
      .expect(400);
    await request(create().app).get(path).expect(401);
    await request(
      create({ loadAllocationPlanContent: vi.fn().mockResolvedValue(null) })
        .app,
    )
      .get(path)
      .set('Cookie', 'hansel_access=access-token')
      .expect(401);
    for (const error of [
      new AllocationPlansNotFoundError(),
      new AllocationPlanUploadRejectedError(),
    ])
      await request(
        create({
          loadAllocationPlanContent: vi.fn().mockRejectedValue(error),
        }).app,
      )
        .get(path)
        .set('Cookie', 'hansel_access=access-token')
        .expect(404, { error: 'allocation_plan_not_found' });
    const unavailable = create({
      loadAllocationPlanContent: vi.fn().mockRejectedValue(new Error('s3')),
    });
    await request(unavailable.app)
      .get(path)
      .set('Cookie', 'hansel_access=access-token')
      .expect(503, { error: 'allocation_plan_unavailable' });
    expect(unavailable.sites.recordEvent).toHaveBeenCalledWith(
      'allocation_plan_preview_unavailable',
    );
  });

  it.each([
    [new AllocationPlansNotFoundError(), 404, 'site_not_found'],
    [new AllocationPlansForbiddenError(), 403, 'allocation_plans_forbidden'],
    [new AllocationPlansConflictError(), 409, 'allocation_plans_conflict'],
    [new AllocationPlanUploadRejectedError(), 400, 'invalid_request'],
  ])(
    'maps Allocation Plan intent rejection safely',
    async (error, status, code) => {
      const fixture = create({
        createAllocationPlanUploadBatch: vi.fn().mockRejectedValue(error),
      });
      await request(fixture.app)
        .post(`/api/sites/${siteId}/allocation-plan-upload-batches`)
        .set('Cookie', 'hansel_access=access-token')
        .set('Origin', 'https://app.example.com')
        .send({
          idempotencyKey: '12345678901234567890123456789012',
          files: [
            {
              filename: 'plan.pdf',
              mediaType: 'application/pdf',
              byteSize: 5,
              checksumSha256: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
            },
          ],
        })
        .expect(status, { error: code });
    },
  );

  it('guards disabled, malformed, and unauthenticated Allocation Plan routes', async () => {
    const disabled = createApp(
      { allowedOrigin: 'https://app.example.com', sitesEnabled: true },
      undefined,
      undefined,
      undefined,
      undefined,
      create().sites,
    );
    await request(disabled)
      .get(`/api/sites/${siteId}/allocation-plans`)
      .expect(404);
    await request(disabled)
      .post(`/api/sites/${siteId}/allocation-plan-upload-batches`)
      .expect(404);
    await request(disabled)
      .post(
        `/api/sites/${siteId}/allocation-plan-uploads/00000000-0000-4000-8000-000000000005/finalize`,
      )
      .expect(404);
    await request(create().app)
      .get('/api/sites/not-a-uuid/allocation-plans')
      .expect(400);
    await request(create().app)
      .get(`/api/sites/${siteId}/allocation-plans`)
      .expect(401);
    await request(create().app)
      .post(`/api/sites/${siteId}/allocation-plan-upload-batches`)
      .expect(403);
    await request(create().app)
      .post(`/api/sites/not-a-uuid/allocation-plan-upload-batches`)
      .set('Origin', 'https://app.example.com')
      .send({})
      .expect(400);
    await request(create().app)
      .post(`/api/sites/${siteId}/allocation-plan-upload-batches`)
      .set('Origin', 'https://app.example.com')
      .send(input)
      .expect(400);
    await request(create().app)
      .post(`/api/sites/${siteId}/allocation-plan-upload-batches`)
      .set('Origin', 'https://app.example.com')
      .send({
        idempotencyKey: '12345678901234567890123456789012',
        files: [
          {
            filename: 'plan.pdf',
            mediaType: 'application/pdf',
            byteSize: 5,
            checksumSha256: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
          },
        ],
      })
      .expect(401);
    await request(create().app)
      .post(`/api/sites/${siteId}/allocation-plan-uploads/not-a-uuid/finalize`)
      .set('Origin', 'https://app.example.com')
      .expect(400);
    await request(create().app)
      .post(
        `/api/sites/${siteId}/allocation-plan-uploads/00000000-0000-4000-8000-000000000005/finalize`,
      )
      .set('Origin', 'https://wrong.example.com')
      .expect(403);
    await request(create().app)
      .post(
        `/api/sites/${siteId}/allocation-plan-uploads/00000000-0000-4000-8000-000000000005/finalize`,
      )
      .set('Origin', 'https://app.example.com')
      .expect(401);
  });

  it.each([
    ['missing', new AllocationPlansNotFoundError(), 404],
    ['forbidden', new AllocationPlansForbiddenError(), 403],
    ['rejected', new AllocationPlanUploadRejectedError(), 409],
    ['unexpected', new Error('offline'), 503],
  ])('maps %s finalize failures', async (_name, error, status) => {
    const fixture = create({
      finalizeAllocationPlanUpload: vi.fn().mockRejectedValue(error),
    });
    await request(fixture.app)
      .post(
        `/api/sites/${siteId}/allocation-plan-uploads/00000000-0000-4000-8000-000000000005/finalize`,
      )
      .set('Cookie', 'hansel_access=access-token')
      .set('Origin', 'https://app.example.com')
      .expect(status);
  });

  it('maps empty and failed Allocation Plan service responses', async () => {
    for (const override of [
      { listAllocationPlans: vi.fn().mockResolvedValue(null) },
      {
        listAllocationPlans: vi
          .fn()
          .mockRejectedValue(new AllocationPlansNotFoundError()),
      },
      { listAllocationPlans: vi.fn().mockRejectedValue(new Error('offline')) },
    ]) {
      const response = await request(create(override).app)
        .get(`/api/sites/${siteId}/allocation-plans`)
        .set('Cookie', 'hansel_access=access-token');
      expect([401, 404, 503]).toContain(response.status);
    }
    const emptyBatch = create({
      createAllocationPlanUploadBatch: vi.fn().mockResolvedValue(null),
    });
    await request(emptyBatch.app)
      .post(`/api/sites/${siteId}/allocation-plan-upload-batches`)
      .set('Cookie', 'hansel_access=access-token')
      .set('Origin', 'https://app.example.com')
      .send({
        idempotencyKey: '12345678901234567890123456789012',
        files: [
          {
            filename: 'plan.pdf',
            mediaType: 'application/pdf',
            byteSize: 5,
            checksumSha256: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
          },
        ],
      })
      .expect(401);
    const failedBatch = create({
      createAllocationPlanUploadBatch: vi
        .fn()
        .mockRejectedValue(new Error('offline')),
    });
    await request(failedBatch.app)
      .post(`/api/sites/${siteId}/allocation-plan-upload-batches`)
      .set('Cookie', 'hansel_access=access-token')
      .set('Origin', 'https://app.example.com')
      .send({
        idempotencyKey: '12345678901234567890123456789012',
        files: [
          {
            filename: 'plan.pdf',
            mediaType: 'application/pdf',
            byteSize: 5,
            checksumSha256: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
          },
        ],
      })
      .expect(503);
    const emptyFinalize = create({
      finalizeAllocationPlanUpload: vi.fn().mockResolvedValue(null),
    });
    await request(emptyFinalize.app)
      .post(
        `/api/sites/${siteId}/allocation-plan-uploads/00000000-0000-4000-8000-000000000005/finalize`,
      )
      .set('Cookie', 'hansel_access=access-token')
      .set('Origin', 'https://app.example.com')
      .expect(401);
  });

  it('loads the tenant-scoped sites page using the private access cookie', async () => {
    const fixture = create();
    const response = await request(fixture.app)
      .get('/api/sites')
      .set('Cookie', 'hansel_access=access-token')
      .expect(200, page);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(fixture.sites.load).toHaveBeenCalledWith('access-token');
  });

  it('creates a site from a strict same-origin request', async () => {
    const fixture = create();
    const response = await request(fixture.app)
      .post('/api/sites')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', 'hansel_access=access-token')
      .send(input)
      .expect(201);
    expect(response.body.destination).toBe(`/sites/${siteId}/activity`);
    expect(fixture.sites.create).toHaveBeenCalledWith('access-token', input);
    expect(fixture.sites.recordEvent).toHaveBeenCalledWith(
      'site_create_succeeded_organization',
    );
  });

  it('maps one-window legacy input to Organization scope [sites-access-scope REQ-021]', async () => {
    const fixture = create();
    await request(fixture.app)
      .post('/api/sites')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', 'hansel_access=access-token')
      .send({
        idempotencyKey: 'legacy-request-0000000000000000001',
        name: 'Legacy site',
        organizationAccess: 'EDIT_MANAGE',
        assignments: [{ email: 'viewer@example.com', role: 'VIEWER' }],
      })
      .expect(201);
    expect(fixture.sites.create).toHaveBeenCalledWith('access-token', {
      idempotencyKey: 'legacy-request-0000000000000000001',
      name: 'Legacy site',
      accessScope: 'ORGANIZATION',
      organizationAccess: 'EDIT_MANAGE',
    });
    expect(fixture.sites.recordEvent).toHaveBeenCalledWith(
      'site_create_legacy_request',
    );
  });

  it.each([
    [new SitesForbiddenError(), 403, 'sites_forbidden'],
    [new SitesUpgradeRequiredError(), 409, 'sites_upgrade_required'],
    [new SitesPaidSeatRequiredError(), 409, 'sites_paid_seat_required'],
    [new SitesConflictError(), 409, 'sites_conflict'],
  ])(
    'maps domain rejection %s without exposing internals',
    async (error, status, code) => {
      const fixture = create({ create: vi.fn().mockRejectedValue(error) });
      await request(fixture.app)
        .post('/api/sites')
        .set('Origin', 'https://app.example.com')
        .set('Cookie', 'hansel_access=access-token')
        .send(input)
        .expect(status, { error: code });
      expect(fixture.sites.recordEvent).toHaveBeenCalledWith(
        `site_create_rejected_${code.replace('sites_', '')}`,
      );
    },
  );

  it('rejects unauthenticated, cross-origin, and malformed create requests', async () => {
    const fixture = create();
    await request(fixture.app)
      .get('/api/sites')
      .expect(401, { error: 'authentication_required' });
    await request(fixture.app)
      .post('/api/sites')
      .set('Origin', 'https://evil.example.com')
      .set('Cookie', 'hansel_access=access-token')
      .send(input)
      .expect(403, { error: 'forbidden' });
    await request(fixture.app)
      .post('/api/sites')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', 'hansel_access=access-token')
      .send({ ...input, unexpected: true })
      .expect(400, { error: 'invalid_request' });
    expect(fixture.sites.recordEvent).toHaveBeenCalledWith(
      'site_create_rejected_invalid_request',
    );
  });

  it('loads activity tenant-safely and returns a generic not-found response', async () => {
    const fixture = create();
    await request(fixture.app)
      .get(`/api/sites/${siteId}`)
      .set('Cookie', 'hansel_access=access-token')
      .expect(200);
    const absent = create({
      activity: vi.fn().mockRejectedValue(new SitesNotFoundError()),
    });
    await request(absent.app)
      .get(`/api/sites/${siteId}`)
      .set('Cookie', 'hansel_access=access-token')
      .expect(404, { error: 'site_not_found' });
    await request(fixture.app)
      .get('/api/sites/not-a-uuid')
      .set('Cookie', 'hansel_access=access-token')
      .expect(400, { error: 'invalid_request' });
  });

  it('fails closed for expired principals and unavailable dependencies', async () => {
    const unavailableLoad = create({
      load: vi.fn().mockRejectedValue(new Error('private')),
    });
    await request(unavailableLoad.app)
      .get('/api/sites')
      .set('Cookie', 'hansel_access=access-token')
      .expect(503, { error: 'sites_unavailable' });
    expect(unavailableLoad.sites.recordEvent).toHaveBeenCalledWith(
      'sites_load_unavailable',
    );
    await request(create({ load: vi.fn().mockResolvedValue(null) }).app)
      .get('/api/sites')
      .set('Cookie', 'hansel_access=expired')
      .expect(401, { error: 'authentication_required' });

    await request(create().app)
      .post('/api/sites')
      .set('Origin', 'https://app.example.com')
      .send(input)
      .expect(401, { error: 'authentication_required' });
    const unauthenticatedCreate = create({
      create: vi.fn().mockResolvedValue(null),
    });
    await request(unauthenticatedCreate.app)
      .post('/api/sites')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', 'hansel_access=expired')
      .send(input)
      .expect(401, { error: 'authentication_required' });
    expect(unauthenticatedCreate.sites.recordEvent).toHaveBeenCalledWith(
      'site_create_rejected_authentication',
    );
    const unavailableCreate = create({
      create: vi.fn().mockRejectedValue(new Error('private')),
    });
    await request(unavailableCreate.app)
      .post('/api/sites')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', 'hansel_access=access-token')
      .send(input)
      .expect(503, { error: 'sites_unavailable' });
    expect(unavailableCreate.sites.recordEvent).toHaveBeenCalledWith(
      'site_create_unavailable',
    );

    await request(create().app)
      .get(`/api/sites/${siteId}`)
      .expect(401, { error: 'authentication_required' });
    await request(create({ activity: vi.fn().mockResolvedValue(null) }).app)
      .get(`/api/sites/${siteId}`)
      .set('Cookie', 'hansel_access=expired')
      .expect(401, { error: 'authentication_required' });
    const unavailableActivity = create({
      activity: vi.fn().mockRejectedValue(new Error('private')),
    });
    await request(unavailableActivity.app)
      .get(`/api/sites/${siteId}`)
      .set('Cookie', 'hansel_access=access-token')
      .expect(503, { error: 'sites_unavailable' });
    expect(unavailableActivity.sites.recordEvent).toHaveBeenCalledWith(
      'site_activity_unavailable',
    );
  });

  it('keeps every sites route behind its rollout boundary', async () => {
    const sites = create().sites;
    const disabled = createApp(
      { allowedOrigin: 'https://app.example.com', sitesEnabled: false },
      undefined,
      undefined,
      undefined,
      undefined,
      sites,
    );
    const list = await request(disabled)
      .get('/api/sites')
      .expect(404, { error: 'not_found' });
    const createResponse = await request(disabled)
      .post('/api/sites')
      .expect(404, { error: 'not_found' });
    const activity = await request(disabled)
      .get(`/api/sites/${siteId}`)
      .expect(404, { error: 'not_found' });
    for (const response of [list, createResponse, activity])
      expect(response.headers['cache-control']).toBe('private, no-store');
    expect(sites.load).not.toHaveBeenCalled();
  });
});

describe('login routes [user-login REQ-003..REQ-008, REQ-016]', () => {
  it.each(['google', 'microsoft', 'apple'])(
    'starts the server-owned %s authorization flow',
    async (provider) => {
      const authentication = {
        login: vi.fn(),
        startExternal: vi
          .fn()
          .mockResolvedValue(`https://provider.example/${provider}`),
        callbackExternal: vi.fn(),
      };
      const response = await request(
        createApp(
          {
            allowedOrigin: 'https://app.example.com',
            loginEnabled: true,
            externalAuthEnabled: true,
          },
          undefined,
          undefined,
          undefined,
          authentication,
        ),
      )
        .get(`/auth/start/${provider}?intent=login`)
        .expect(303);
      expect(response.headers.location).toBe(
        `https://provider.example/${provider}`,
      );
      expect(authentication.startExternal).toHaveBeenCalledWith(
        provider,
        'login',
      );
    },
  );

  it('sets Hansel cookies after a validated provider callback and fails generically otherwise', async () => {
    const callbackExternal = vi
      .fn()
      .mockResolvedValueOnce({
        status: 'accepted',
        destination: '/dashboard',
        applicationSession: {
          accessCredential: 'external-access',
          refreshCredential: 'external-refresh',
        },
      })
      .mockResolvedValueOnce({ status: 'rejected' });
    const externalApp = createApp(
      {
        allowedOrigin: 'https://app.example.com',
        loginEnabled: true,
        externalAuthEnabled: true,
      },
      undefined,
      undefined,
      undefined,
      { login: vi.fn(), startExternal: vi.fn(), callbackExternal },
    );
    const accepted = await request(externalApp)
      .get('/auth/callback/google?code=code&state=state')
      .expect(303);
    expect(accepted.headers.location).toBe('/dashboard');
    expect(accepted.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('hansel_access=external-access'),
        expect.stringContaining('hansel_refresh=external-refresh'),
      ]),
    );
    expect(callbackExternal).toHaveBeenNthCalledWith(1, 'google', {
      code: 'code',
      state: 'state',
    });
    const rejected = await request(externalApp)
      .post('/auth/callback/apple')
      .type('form')
      .send({ error: 'access_denied', state: 'state' })
      .expect(303);
    expect(rejected.headers.location).toBe(
      '/login?error=authentication_failed',
    );
  });

  it('serves the accessible progressive login page without JavaScript', async () => {
    const loginApp = createApp(
      { allowedOrigin: 'https://app.example.com', loginEnabled: true },
      undefined,
      undefined,
      undefined,
      { login: vi.fn() },
    );
    const response = await request(loginApp).get('/login').expect(200);

    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.text).toContain(
      '<h1 id="login-heading">Log in to your account</h1>',
    );
    expect(response.text).toContain('action="/api/auth/login" method="post"');
    expect(response.text).toContain('autocomplete="current-password"');
    expect(response.text.match(/class="auth-field"/g)).toHaveLength(2);
    for (const provider of ['google', 'microsoft', 'apple'])
      expect(response.text).toContain(`/auth/start/${provider}?intent=login`);
    for (const provider of ['google', 'microsoft', 'apple'])
      expect(response.text).toContain(`src="/assets/${provider}-logo.svg"`);
    expect(response.text).toContain('data-testid="login-provider-divider"');
    expect(response.text).not.toContain('By creating an account');
    const reset = await request(loginApp)
      .get('/login?password_reset=success')
      .expect(200);
    expect(reset.text).toContain('Your password has been reset.');
  });

  it('redirects an existing valid application session away from login', async () => {
    const dashboard = {
      load: vi.fn().mockResolvedValue({
        viewer: {
          displayName: 'Nabin Singh',
          initials: 'NS',
          roleLabel: 'Owner',
        },
      }),
      logout: vi.fn(),
    };
    const response = await request(
      createApp(
        { allowedOrigin: 'https://app.example.com', loginEnabled: true },
        undefined,
        undefined,
        dashboard,
        { login: vi.fn() },
      ),
    )
      .get('/login')
      .set('Cookie', 'hansel_access=access; hansel_refresh=refresh')
      .expect(303);
    expect(response.headers.location).toBe('/dashboard');
    expect(dashboard.load).toHaveBeenCalledWith({
      accessCredential: 'access',
      refreshCredential: 'refresh',
    });
  });

  it('returns progressive generic failures without retaining a password', async () => {
    const authentication = {
      login: vi.fn().mockResolvedValue({ status: 'rejected' }),
    };
    const loginApp = createApp(
      { allowedOrigin: 'https://app.example.com', loginEnabled: true },
      undefined,
      undefined,
      undefined,
      authentication,
    );
    const response = await request(loginApp)
      .post('/api/auth/login')
      .set('Origin', 'https://app.example.com')
      .type('form')
      .send({ email: 'owner@example.com', password: 'wrong-secret' })
      .expect(401);

    expect(response.type).toContain('html');
    expect(response.text).toContain(
      'We couldn&#39;t log you in. Check your details and try again.',
    );
    expect(response.text).toContain('value="owner@example.com"');
    expect(response.text).not.toContain('wrong-secret');
  });

  it('uses a 303 redirect after successful native-form login', async () => {
    const response = await request(
      createApp(
        { allowedOrigin: 'https://app.example.com', loginEnabled: true },
        undefined,
        undefined,
        undefined,
        {
          login: vi.fn().mockResolvedValue({
            status: 'accepted',
            destination: '/dashboard',
          }),
        },
      ),
    )
      .post('/api/auth/login')
      .set('Origin', 'https://app.example.com')
      .type('form')
      .send({ email: 'owner@example.com', password: 'valid-secret' })
      .expect(303);

    expect(response.headers.location).toBe('/dashboard');
  });

  it('accepts a same-origin native form when the browser omits Origin', async () => {
    const response = await request(
      createApp(
        { allowedOrigin: 'http://127.0.0.1:5173', loginEnabled: true },
        undefined,
        undefined,
        undefined,
        {
          login: vi.fn().mockResolvedValue({
            status: 'accepted',
            destination: '/dashboard',
          }),
        },
      ),
    )
      .post('/api/auth/login')
      .set('Host', 'reverse-proxy.internal')
      .set('Sec-Fetch-Site', 'same-origin')
      .type('form')
      .send({ email: 'owner@example.com', password: 'valid-secret' })
      .expect(303);
    expect(response.headers.location).toBe('/dashboard');
  });

  it('sets Hansel session cookies and returns only the server-owned destination', async () => {
    const authentication = {
      login: vi.fn().mockResolvedValue({
        status: 'accepted',
        destination: '/dashboard',
        applicationSession: {
          accessCredential: 'access',
          refreshCredential: 'refresh',
        },
      }),
    };
    const response = await request(
      createApp(
        {
          allowedOrigin: 'https://app.example.com',
          loginEnabled: true,
        },
        undefined,
        undefined,
        undefined,
        authentication,
      ),
    )
      .post('/api/auth/login')
      .set('Origin', 'https://app.example.com')
      .send({
        email: '  OWNER@example.com ',
        password: 'Correct horse battery staple!7',
      })
      .expect(200, { destination: '/dashboard' });

    expect(authentication.login).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'Correct horse battery staple!7',
    });
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.headers.vary).toContain('Cookie');
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /^hansel_access=access;.*Path=\/;.*HttpOnly;.*Secure;.*SameSite=Lax$/,
        ),
        expect.stringMatching(
          /^hansel_refresh=refresh;.*Path=\/api\/dashboard;.*HttpOnly;.*Secure;.*SameSite=Lax$/,
        ),
      ]),
    );
  });

  it('issues onboarding cookies for a verified incomplete account', async () => {
    const response = await request(
      createApp(
        { allowedOrigin: 'https://app.example.com', loginEnabled: true },
        undefined,
        undefined,
        undefined,
        {
          login: vi.fn().mockResolvedValue({
            status: 'accepted',
            destination: '/onboarding/about-you',
            onboardingSession: {
              onboardingCredential: 'onboarding',
              csrfProof: 'csrf-proof',
            },
          }),
        },
      ),
    )
      .post('/api/auth/login')
      .set('Origin', 'https://app.example.com')
      .send({ email: 'owner@example.com', password: 'valid-secret' })
      .expect(200, { destination: '/onboarding/about-you' });

    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('hansel_onboarding=onboarding'),
        expect.stringContaining('hansel_onboarding_csrf=csrf-proof'),
      ]),
    );
  });

  it('fails closed when login or external authorization is disabled or malformed', async () => {
    const disabled = createApp(
      {
        allowedOrigin: 'https://app.example.com',
        loginEnabled: false,
        externalAuthEnabled: false,
      },
      undefined,
      undefined,
      undefined,
      { login: vi.fn() },
    );
    await request(disabled).get('/login').expect(404);
    await request(disabled)
      .post('/api/auth/login')
      .set('Origin', 'https://app.example.com')
      .send({ email: 'owner@example.com', password: 'secret' })
      .expect(404, { error: 'not_found' });
    await request(disabled).get('/auth/start/google?intent=login').expect(404);
    await request(disabled).get('/auth/callback/not-a-provider').expect(404);

    const enabled = createApp(
      {
        allowedOrigin: 'https://app.example.com',
        loginEnabled: true,
        externalAuthEnabled: true,
      },
      undefined,
      undefined,
      undefined,
      { login: vi.fn(), startExternal: vi.fn(), callbackExternal: vi.fn() },
    );
    await request(enabled)
      .get('/auth/start/google?intent=onboarding')
      .expect(404);
    await request(enabled).get('/auth/start/unknown?intent=login').expect(404);
  });

  it('maps provider dependency failures to one safe login error', async () => {
    const recordEvent = vi.fn();
    const external = createApp(
      {
        allowedOrigin: 'https://app.example.com',
        loginEnabled: true,
        externalAuthEnabled: true,
      },
      undefined,
      undefined,
      undefined,
      {
        login: vi.fn(),
        startExternal: vi.fn().mockRejectedValue(new Error('private detail')),
        callbackExternal: vi
          .fn()
          .mockRejectedValue(new Error('private detail')),
        recordEvent,
      },
    );
    expect(
      (
        await request(external)
          .get('/auth/start/google?intent=login')
          .expect(303)
      ).headers.location,
    ).toBe('/login?error=provider_unavailable');
    expect(
      (
        await request(external)
          .get('/auth/callback/google?code=code&state=state')
          .expect(303)
      ).headers.location,
    ).toBe('/login?error=provider_unavailable');
    expect(recordEvent).toHaveBeenCalledTimes(2);
    expect(recordEvent).toHaveBeenCalledWith('external_provider_unavailable');
  });

  it('keeps the login page available when session preflight fails and refreshes cookies when it succeeds', async () => {
    const failingDashboard = {
      load: vi.fn().mockRejectedValue(new Error('private detail')),
      logout: vi.fn(),
    };
    await request(
      createApp(
        { allowedOrigin: 'https://app.example.com', loginEnabled: true },
        undefined,
        undefined,
        failingDashboard,
        { login: vi.fn() },
      ),
    )
      .get('/login')
      .expect(200);

    const refreshingDashboard = {
      load: vi.fn().mockResolvedValue({
        viewer: { displayName: 'Ava', initials: 'A', roleLabel: 'Owner' },
        applicationSession: {
          accessCredential: 'new-access',
          refreshCredential: 'new-refresh',
        },
      }),
      logout: vi.fn(),
    };
    const response = await request(
      createApp(
        { allowedOrigin: 'https://app.example.com', loginEnabled: true },
        undefined,
        undefined,
        refreshingDashboard,
        { login: vi.fn() },
      ),
    )
      .get('/login')
      .expect(303);
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('hansel_access=new-access'),
        expect.stringContaining('hansel_refresh=new-refresh'),
      ]),
    );
  });

  it('validates origins and payloads for JSON and progressive form login', async () => {
    const loginApp = createApp(
      { allowedOrigin: 'https://app.example.com', loginEnabled: true },
      undefined,
      undefined,
      undefined,
      { login: vi.fn() },
    );
    await request(loginApp)
      .post('/api/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ email: 'owner@example.com', password: 'secret' })
      .expect(403, { error: 'forbidden' });
    await request(loginApp)
      .post('/api/auth/login')
      .type('form')
      .send({ email: 'owner@example.com', password: 'secret' })
      .expect(403, { error: 'forbidden' });
    await request(loginApp)
      .post('/api/auth/login')
      .set('Origin', 'https://app.example.com')
      .send({ email: 'not-email', password: '' })
      .expect(400, { error: 'invalid_request' });
    const form = await request(loginApp)
      .post('/api/auth/login')
      .set('Origin', 'https://app.example.com')
      .type('form')
      .send({ email: 'not-email', password: '' })
      .expect(400);
    expect(form.text).toContain('Enter a valid email address and password.');
    const formWithoutEmail = await request(loginApp)
      .post('/api/auth/login')
      .set('Origin', 'https://app.example.com')
      .type('form')
      .send({ password: '' })
      .expect(400);
    expect(formWithoutEmail.text).toContain(
      'Enter a valid email address and password.',
    );
  });

  it('returns generic JSON rejection and safe HTML/JSON availability failures', async () => {
    const rejected = createApp(
      { allowedOrigin: 'https://app.example.com', loginEnabled: true },
      undefined,
      undefined,
      undefined,
      { login: vi.fn().mockResolvedValue({ status: 'rejected' }) },
    );
    await request(rejected)
      .post('/api/auth/login')
      .set('Origin', 'https://app.example.com')
      .send({ email: 'owner@example.com', password: 'wrong' })
      .expect(401, { error: 'authentication_failed' });

    const unavailable = createApp(
      { allowedOrigin: 'https://app.example.com', loginEnabled: true },
      undefined,
      undefined,
      undefined,
      {
        login: vi.fn().mockRejectedValue(new Error('private detail')),
        recordEvent: vi.fn(),
      },
    );
    await request(unavailable)
      .post('/api/auth/login')
      .set('Origin', 'https://app.example.com')
      .send({ email: 'owner@example.com', password: 'secret' })
      .expect(503, { error: 'login_unavailable' });
    const form = await request(unavailable)
      .post('/api/auth/login')
      .set('Origin', 'https://app.example.com')
      .type('form')
      .send({ email: 'owner@example.com', password: 'secret' })
      .expect(503);
    expect(form.text).toContain(
      'Login is temporarily unavailable. Please try again.',
    );
  });
});

describe('password recovery routes [password-recovery REQ-002..REQ-019]', () => {
  function recoveryApp(
    overrides: Record<string, unknown> = {},
    enabled = true,
  ) {
    return createApp(
      {
        allowedOrigin: 'https://app.example.com',
        loginEnabled: true,
        passwordRecoveryEnabled: enabled,
      },
      undefined,
      undefined,
      undefined,
      {
        login: vi.fn(),
        requestPasswordRecovery: vi
          .fn()
          .mockResolvedValue({ status: 'accepted' }),
        resetPassword: vi.fn().mockResolvedValue({ destination: '/login' }),
        ...overrides,
      },
    );
  }

  it('renders progressive pages and accepts a generic normalized request', async () => {
    const requestPasswordRecovery = vi
      .fn()
      .mockResolvedValue({ status: 'accepted' });
    const recoveryApp = createApp(
      {
        allowedOrigin: 'https://app.example.com',
        loginEnabled: true,
        passwordRecoveryEnabled: true,
      },
      undefined,
      undefined,
      undefined,
      {
        login: vi.fn(),
        requestPasswordRecovery,
        resetPassword: vi.fn(),
      },
    );

    const forgot = await request(recoveryApp)
      .get('/forgot-password')
      .expect('Cache-Control', 'private, no-store')
      .expect('Vary', /Origin.*Cookie/)
      .expect(200);
    expect(forgot.text).toContain('Forgot your password?');
    expect(forgot.text).toContain(
      'action="/api/auth/password-recovery/request"',
    );
    const reset = await request(recoveryApp)
      .get('/reset-password')
      .expect('Cache-Control', 'private, no-store')
      .expect('Vary', /Origin.*Cookie/)
      .expect(200);
    expect(reset.text).toContain('Reset your password');
    expect(reset.text).toContain('autocomplete="one-time-code"');

    await request(recoveryApp)
      .post('/api/auth/password-recovery/request')
      .set('Origin', 'https://app.example.com')
      .send({ email: '  OWNER@Example.com ' })
      .expect(202, { status: 'accepted' });
    expect(requestPasswordRecovery).toHaveBeenCalledWith({
      email: 'owner@example.com',
    });
  });

  it('keeps request dependency failures generic', async () => {
    const recordEvent = vi.fn();
    const recoveryApp = createApp(
      {
        allowedOrigin: 'https://app.example.com',
        passwordRecoveryEnabled: true,
      },
      undefined,
      undefined,
      undefined,
      {
        login: vi.fn(),
        requestPasswordRecovery: vi
          .fn()
          .mockRejectedValue(new Error('private detail')),
        resetPassword: vi.fn(),
        recordEvent,
      },
    );
    await request(recoveryApp)
      .post('/api/auth/password-recovery/request')
      .set('Origin', 'https://app.example.com')
      .send({ email: 'owner@example.com' })
      .expect(503, { error: 'password_recovery_unavailable' });
    expect(recordEvent).toHaveBeenCalledWith(
      'password_recovery_unexpected_failure',
    );
  });

  it('closes disabled and incomplete recovery modules', async () => {
    const disabled = recoveryApp({}, false);
    await request(disabled).get('/forgot-password').expect(404);
    await request(disabled).get('/reset-password').expect(404);
    await request(disabled)
      .post('/api/auth/password-recovery/request')
      .send({})
      .expect(404);
    await request(disabled)
      .post('/api/auth/password-recovery/reset')
      .send({})
      .expect(404);

    const incomplete = createApp(
      {
        allowedOrigin: 'https://app.example.com',
        loginEnabled: true,
        passwordRecoveryEnabled: true,
      },
      undefined,
      undefined,
      undefined,
      { login: vi.fn() },
    );
    await request(incomplete).get('/forgot-password').expect(404);
    await request(incomplete).get('/reset-password').expect(404);
    await request(incomplete)
      .post('/api/auth/password-recovery/reset')
      .send({})
      .expect(404);
  });

  it('rejects untrusted and malformed recovery requests in both representations', async () => {
    const app = recoveryApp();
    await request(app)
      .post('/api/auth/password-recovery/request')
      .set('Origin', 'https://evil.example')
      .send({ email: 'owner@example.com' })
      .expect(403);
    await request(app)
      .post('/api/auth/password-recovery/request')
      .set('Origin', 'https://app.example.com')
      .send({ email: 'invalid' })
      .expect(400, { error: 'invalid_request' });
    const requestForm = await request(app)
      .post('/api/auth/password-recovery/request')
      .set('Origin', 'https://app.example.com')
      .type('form')
      .send({ email: 'invalid' })
      .expect(400);
    expect(requestForm.text).toContain('Enter a valid email address.');

    await request(app)
      .post('/api/auth/password-recovery/reset')
      .set('Origin', 'https://evil.example')
      .send({})
      .expect(403);
    await request(app)
      .post('/api/auth/password-recovery/reset')
      .set('Origin', 'https://app.example.com')
      .send({ email: 'owner@example.com' })
      .expect(400, { error: 'invalid_request' });
    const resetForm = await request(app)
      .post('/api/auth/password-recovery/reset')
      .set('Origin', 'https://app.example.com')
      .type('form')
      .send({ email: 'owner@example.com', confirmPassword: 'ignored' })
      .expect(400);
    expect(resetForm.text).toContain('six-digit code');
  });

  it('supports progressive recovery request success and failure', async () => {
    const accepted = recoveryApp();
    await request(accepted)
      .get('/reset-password?requested=1')
      .expect(200)
      .expect(/eligible Hansel account/);
    await request(accepted)
      .post('/api/auth/password-recovery/request')
      .set('Origin', 'https://app.example.com')
      .type('form')
      .send({ email: ' OWNER@Example.com ' })
      .expect(303)
      .expect('Location', '/reset-password?requested=1');

    const failed = recoveryApp({
      requestPasswordRecovery: vi.fn().mockRejectedValue(new Error('private')),
    });
    const response = await request(failed)
      .post('/api/auth/password-recovery/request')
      .set('Origin', 'https://app.example.com')
      .type('form')
      .send({ email: 'owner@example.com' })
      .expect(503);
    expect(response.text).toContain('temporarily unavailable');
  });

  it('resets safely across JSON and progressive outcomes', async () => {
    const valid = {
      email: ' OWNER@Example.com ',
      code: '123456',
      password: 'Correct horse battery staple!7',
      confirmPassword: 'Correct horse battery staple!7',
    };
    const resetPassword = vi.fn().mockResolvedValue({ destination: '/login' });
    const accepted = recoveryApp({ resetPassword });
    await request(accepted)
      .post('/api/auth/password-recovery/reset')
      .set('Origin', 'https://app.example.com')
      .send(valid)
      .expect(400);
    await request(accepted)
      .post('/api/auth/password-recovery/reset')
      .set('Origin', 'https://app.example.com')
      .send({ email: valid.email, code: valid.code, password: valid.password })
      .expect(200, { destination: '/login' });
    await request(accepted)
      .post('/api/auth/password-recovery/reset')
      .set('Origin', 'https://app.example.com')
      .type('form')
      .send(valid)
      .expect(303)
      .expect('Location', '/login?password_reset=success');
    expect(resetPassword).toHaveBeenCalledWith({
      email: 'owner@example.com',
      code: '123456',
      password: valid.password,
    });

    for (const invalidForm of [
      { ...valid, confirmPassword: 'Different password value!8A' },
      { ...valid, unexpected: 'not-allowed' },
    ])
      await request(accepted)
        .post('/api/auth/password-recovery/reset')
        .set('Origin', 'https://app.example.com')
        .type('form')
        .send(invalidForm)
        .expect(400);

    const rejected = recoveryApp({
      resetPassword: vi
        .fn()
        .mockRejectedValue(new PasswordResetRejectedError()),
    });
    await request(rejected)
      .post('/api/auth/password-recovery/reset')
      .set('Origin', 'https://app.example.com')
      .send({ email: valid.email, code: valid.code, password: valid.password })
      .expect(400, { error: 'password_reset_rejected' });
    const rejectedForm = await request(rejected)
      .post('/api/auth/password-recovery/reset')
      .set('Origin', 'https://app.example.com')
      .type('form')
      .send(valid)
      .expect(400);
    expect(rejectedForm.text).toContain('couldn&#39;t reset your password');

    const recordEvent = vi.fn();
    const unavailable = recoveryApp({
      resetPassword: vi.fn().mockRejectedValue(new Error('private')),
      recordEvent,
    });
    await request(unavailable)
      .post('/api/auth/password-recovery/reset')
      .set('Origin', 'https://app.example.com')
      .send({ email: valid.email, code: valid.code, password: valid.password })
      .expect(503, { error: 'password_reset_unavailable' });
    const unavailableForm = await request(unavailable)
      .post('/api/auth/password-recovery/reset')
      .set('Origin', 'https://app.example.com')
      .type('form')
      .send(valid)
      .expect(503);
    expect(unavailableForm.text).toContain('temporarily unavailable');
    expect(recordEvent).toHaveBeenCalledWith(
      'password_reset_unexpected_failure',
    );
    expect(recordEvent).toHaveBeenCalledWith('password_reset_unavailable');
  });
});

describe('dashboard routes [dashboard-home REQ-006, REQ-007, REQ-010..REQ-013]', () => {
  it('logs out from a trusted origin and clears both application cookies [dashboard-logout REQ-004..REQ-007]', async () => {
    const dashboard = {
      load: vi.fn(),
      logout: vi.fn().mockResolvedValue(undefined),
    };
    const response = await request(
      createApp(
        { allowedOrigin: 'https://app.example.com', dashboardEnabled: true },
        undefined,
        undefined,
        dashboard,
      ),
    )
      .post('/api/dashboard/logout')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', 'hansel_access=access; hansel_refresh=refresh')
      .expect(204);

    expect(dashboard.logout).toHaveBeenCalledWith({
      accessCredential: 'access',
      refreshCredential: 'refresh',
    });
    const cookies = response.headers['set-cookie'] as unknown as string[];
    expect(cookies).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /^hansel_access=;.*Path=\/;.*HttpOnly;.*Secure;.*SameSite=Lax$/,
        ),
        expect.stringMatching(
          /^hansel_refresh=;.*Path=\/api\/dashboard;.*HttpOnly;.*Secure;.*SameSite=Lax$/,
        ),
      ]),
    );
  });

  it('rejects untrusted logout before session access and honors the dashboard flag [dashboard-logout REQ-006]', async () => {
    const dashboard = { load: vi.fn(), logout: vi.fn() };
    const enabled = createApp(
      { allowedOrigin: 'https://app.example.com', dashboardEnabled: true },
      undefined,
      undefined,
      dashboard,
    );
    for (const origin of [undefined, 'null', 'https://attacker.example']) {
      let call = request(enabled).post('/api/dashboard/logout');
      if (origin) call = call.set('Origin', origin);
      const response = await call.expect(403, { error: 'forbidden' });
      expect(response.headers['set-cookie']).toBeUndefined();
    }
    expect(dashboard.logout).not.toHaveBeenCalled();

    await request(
      createApp(
        { allowedOrigin: 'https://app.example.com', dashboardEnabled: false },
        undefined,
        undefined,
        dashboard,
      ),
    )
      .post('/api/dashboard/logout')
      .set('Origin', 'https://app.example.com')
      .expect(404, { error: 'not_found' });
    expect(dashboard.logout).not.toHaveBeenCalled();
  });

  it('keeps cookies when logout persistence is unavailable [dashboard-logout REQ-008]', async () => {
    const dashboard = {
      load: vi.fn(),
      logout: vi.fn().mockRejectedValue(new Error('database unavailable')),
    };
    const response = await request(
      createApp(
        { allowedOrigin: 'http://localhost:5173' },
        undefined,
        undefined,
        dashboard,
      ),
    )
      .post('/api/dashboard/logout')
      .set('Origin', 'http://localhost:5173')
      .expect(503, { error: 'logout_unavailable' });
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('returns only the private authenticated viewer DTO', async () => {
    const dashboard = {
      load: vi.fn().mockResolvedValue({
        viewer: {
          displayName: 'Nabin Singh',
          initials: 'NS',
          roleLabel: 'Owner',
        },
      }),
      logout: vi.fn(),
      recordEvent: vi.fn(),
    };
    const response = await request(
      createApp(
        {
          allowedOrigin: 'https://app.example.com',
          dashboardEnabled: true,
        },
        undefined,
        undefined,
        dashboard,
      ),
    )
      .get('/api/dashboard')
      .set('Cookie', 'hansel_access=access; hansel_refresh=refresh')
      .expect(200, {
        viewer: {
          displayName: 'Nabin Singh',
          initials: 'NS',
          roleLabel: 'Owner',
        },
      });

    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.headers.vary).toContain('Cookie');
    expect(dashboard.load).toHaveBeenCalledWith({
      accessCredential: 'access',
      refreshCredential: 'refresh',
    });
  });

  it('sets rotated credentials while keeping them out of the response', async () => {
    const dashboard = {
      load: vi.fn().mockResolvedValue({
        viewer: {
          displayName: 'Nabin Singh',
          initials: 'NS',
          roleLabel: 'Owner',
        },
        applicationSession: {
          accessCredential: 'new-access',
          refreshCredential: 'new-refresh',
        },
      }),
      logout: vi.fn(),
    };
    const response = await request(
      createApp(
        { allowedOrigin: 'https://app.example.com' },
        undefined,
        undefined,
        dashboard,
      ),
    )
      .get('/api/dashboard')
      .set('Cookie', 'hansel_refresh=refresh')
      .expect(200);

    expect(response.body).toEqual({
      viewer: {
        displayName: 'Nabin Singh',
        initials: 'NS',
        roleLabel: 'Owner',
      },
    });
    expect(String(response.headers['set-cookie'])).toContain(
      'hansel_access=new-access',
    );
    expect(String(response.headers['set-cookie'])).toContain(
      'hansel_refresh=new-refresh',
    );
  });

  it('fails closed, clears credentials, and honors the rollout flag', async () => {
    const dashboard = {
      load: vi.fn().mockResolvedValue(null),
      logout: vi.fn(),
      recordEvent: vi.fn(),
    };
    const enabled = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      undefined,
      dashboard,
    );
    const rejected = await request(enabled)
      .get('/api/dashboard')
      .expect(401, { error: 'authentication_required' });
    expect(dashboard.load).toHaveBeenCalledWith({
      accessCredential: null,
      refreshCredential: null,
    });
    expect(dashboard.recordEvent).toHaveBeenCalledWith(
      'dashboard_authentication_rejected',
    );
    expect(String(rejected.headers['set-cookie'])).toContain('hansel_access=;');

    await request(
      createApp(
        {
          allowedOrigin: 'https://app.example.com',
          dashboardEnabled: false,
        },
        undefined,
        undefined,
        dashboard,
      ),
    )
      .get('/api/dashboard')
      .expect(404, { error: 'not_found' });
  });

  it('records and delegates unexpected dashboard failures', async () => {
    const errorLog = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const dashboard = {
      load: vi.fn().mockRejectedValue(new Error('database unavailable')),
      logout: vi.fn(),
      recordEvent: vi.fn(),
    };
    await request(
      createApp(
        { allowedOrigin: 'https://app.example.com' },
        undefined,
        undefined,
        dashboard,
      ),
    )
      .get('/api/dashboard')
      .expect(500);
    expect(dashboard.recordEvent).toHaveBeenCalledWith(
      'dashboard_unexpected_failure',
    );
    expect(errorLog).toHaveBeenCalledOnce();
    errorLog.mockRestore();
  });
});

describe('discovery routes [onboarding-discovery REQ-001, REQ-005..REQ-013, REQ-018]', () => {
  const page = {
    submissionKey: 'x'.repeat(43),
    methods: [...discoveryManagementOptions],
  };
  const input = {
    action: 'submit',
    currentManagement: 'pdf',
    challenges: 'Version control',
    submissionKey: page.submissionKey,
  };
  const module = (overrides: Record<string, unknown> = {}) => ({
    createAccount: vi.fn(),
    verifyEmail: vi.fn(),
    resendVerification: vi.fn(),
    submitPersonalProfile: vi.fn(),
    loadDiscovery: vi.fn().mockResolvedValue(page),
    completeDiscovery: vi.fn().mockResolvedValue({
      nextStep: 'dashboard',
      destination: '/dashboard',
      applicationSession: {
        accessCredential: 'application-access',
        refreshCredential: 'application-refresh',
      },
    }),
    recordDiscoveryEvent: vi.fn(),
    ...overrides,
  });
  const create = (overrides: Record<string, unknown> = {}, enabled = true) =>
    createApp(
      {
        allowedOrigin: 'https://app.example.com',
        discoveryEnabled: enabled,
      },
      undefined,
      module(overrides),
    );
  const cookies = 'hansel_onboarding=credential; hansel_onboarding_csrf=proof';

  it('loads private JSON and exact progressive Figma wording', async () => {
    const json = await request(create())
      .get('/api/onboarding/discovery')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(200);
    expect(json.body).toEqual(page);
    expect(json.headers['cache-control']).toBe('private, no-store');
    const html = await request(create())
      .get('/onboarding/discovery')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(200);
    expect(html.text).toContain('Could you tell us more?');
    expect(html.text).toContain('How do you manage your signage currently?');
    expect(html.text).toContain('Biggest challenges your team faces');
    expect(html.text).toContain('Skip for now');
    expect(html.text).toContain('href="/onboarding/organization-profile"');
  });

  it('submits JSON and submit/skip native forms to the server dashboard', async () => {
    const feature = module();
    const json = await request(
      createApp(
        { allowedOrigin: 'https://app.example.com' },
        undefined,
        feature,
      ),
    )
      .post('/api/onboarding/discovery')
      .set('Origin', 'https://app.example.com')
      .set('x-hansel-csrf', 'proof')
      .set('Cookie', cookies)
      .send(input)
      .expect(200, { nextStep: 'dashboard', destination: '/dashboard' });
    expect(String(json.headers['set-cookie'])).toContain('hansel_onboarding=;');
    expect(String(json.headers['set-cookie'])).toContain(
      'hansel_access=application-access',
    );
    expect(String(json.headers['set-cookie'])).toContain(
      'hansel_refresh=application-refresh',
    );
    expect(feature.completeDiscovery).toHaveBeenCalledWith(
      'credential',
      'proof',
      input,
    );

    await request(create())
      .post('/api/onboarding/discovery')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', cookies)
      .type('form')
      .send(input)
      .expect(303)
      .expect('Location', '/dashboard');
    const skipFeature = module();
    await request(
      createApp(
        { allowedOrigin: 'https://app.example.com' },
        undefined,
        skipFeature,
      ),
    )
      .post('/api/onboarding/discovery')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', cookies)
      .type('form')
      .send({ ...input, action: 'skip' })
      .expect(303)
      .expect('Location', '/dashboard');
    expect(skipFeature.completeDiscovery).toHaveBeenCalledWith(
      'credential',
      'proof',
      { action: 'skip', submissionKey: page.submissionKey },
    );
  });

  it('rejects disabled, missing, invalid, forged, conflict, and stale requests', async () => {
    await request(create({}, false))
      .get('/api/onboarding/discovery')
      .expect(404);
    await request(create({}, false)).get('/onboarding/discovery').expect(404);
    await request(create({}, false))
      .post('/api/onboarding/discovery')
      .send(input)
      .expect(404);
    await request(create()).get('/api/onboarding/discovery').expect(401);
    await request(create())
      .get('/onboarding/discovery')
      .expect(303)
      .expect('Location', '/onboarding');
    await request(create())
      .post('/api/onboarding/discovery')
      .send({})
      .expect(400);
    await request(create())
      .post('/api/onboarding/discovery')
      .set('Origin', 'https://evil.example')
      .set('Cookie', cookies)
      .send(input)
      .expect(401);
    await request(
      create({
        completeDiscovery: vi
          .fn()
          .mockRejectedValue(new DiscoveryConflictError()),
      }),
    )
      .post('/api/onboarding/discovery')
      .set('Origin', 'https://app.example.com')
      .set('x-hansel-csrf', 'proof')
      .set('Cookie', cookies)
      .send(input)
      .expect(409, { error: 'discovery_conflict' });
    await request(
      create({
        completeDiscovery: vi
          .fn()
          .mockRejectedValue(new DiscoveryTransitionError()),
      }),
    )
      .post('/api/onboarding/discovery')
      .set('Origin', 'https://app.example.com')
      .set('x-hansel-csrf', 'proof')
      .set('Cookie', cookies)
      .send(input)
      .expect(409, { error: 'onboarding_transition_failed' });
  });

  it('redirects unavailable pages and renders progressive validation recovery', async () => {
    const unavailable = create({
      loadDiscovery: vi.fn().mockRejectedValue(new DiscoveryTransitionError()),
    });
    await request(unavailable)
      .get('/api/onboarding/discovery')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(401);
    await request(unavailable)
      .get('/onboarding/discovery')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(303)
      .expect('Location', '/onboarding');
    const recovery = await request(create())
      .post('/api/onboarding/discovery')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', cookies)
      .type('form')
      .send({ ...input, currentManagement: '' })
      .expect(400);
    expect(recovery.text).toContain('could not save your answers');
    expect(recovery.text).toContain('Version control');
    const otherRecovery = await request(create())
      .post('/api/onboarding/discovery')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', cookies)
      .type('form')
      .send({ ...input, currentManagement: 'other' })
      .expect(400);
    expect(otherRecovery.text).toContain(
      'name="currentManagementOther" maxlength="100" required',
    );
  });

  it('uses safe progressive fallback and records validation and unexpected failures', async () => {
    const feature = module();
    await request(
      createApp(
        { allowedOrigin: 'https://app.example.com' },
        undefined,
        feature,
      ),
    )
      .post('/api/onboarding/discovery')
      .send({})
      .expect(400);
    expect(feature.recordDiscoveryEvent).toHaveBeenCalledWith(
      'discovery_validation_rejected',
    );

    const fallback = await request(
      create({
        loadDiscovery: vi
          .fn()
          .mockRejectedValue(new DiscoveryTransitionError()),
      }),
    )
      .post('/api/onboarding/discovery')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', cookies)
      .type('form')
      .send({ ...input, currentManagement: '' })
      .expect(400);
    expect(fallback.text).toBe('We could not save your answers.');

    const errorLog = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const failure = new Error('database unavailable');
    await request(create({ loadDiscovery: vi.fn().mockRejectedValue(failure) }))
      .post('/api/onboarding/discovery')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', cookies)
      .type('form')
      .send({ ...input, currentManagement: '' })
      .expect(500);
    await request(create({ loadDiscovery: vi.fn().mockRejectedValue(failure) }))
      .get('/api/onboarding/discovery')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(500);
    await request(create({ loadDiscovery: vi.fn().mockRejectedValue(failure) }))
      .get('/onboarding/discovery')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(500);
    await request(
      create({ completeDiscovery: vi.fn().mockRejectedValue(failure) }),
    )
      .post('/api/onboarding/discovery')
      .set('Origin', 'https://app.example.com')
      .set('x-hansel-csrf', 'proof')
      .set('Cookie', cookies)
      .send(input)
      .expect(500);
    expect(errorLog).toHaveBeenCalledTimes(4);
    errorLog.mockRestore();
  });
});

describe('API [REQ-002, REQ-007]', () => {
  it('returns the specified health response', async () => {
    const response = await request(app).get('/api/health').expect(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('returns a stable not-found response', async () => {
    await request(app).get('/missing').expect(404, { error: 'not_found' });
  });

  it('serves the progressive personal-profile form without JavaScript [REQ-054, REQ-086]', async () => {
    const response = await request(app)
      .get('/onboarding/about-you')
      .expect('Content-Type', /html/)
      .expect(200);
    expect(response.text).toContain('Tell us about you');
    expect(response.text).toContain('name="jobTitleOther"');
    expect(response.text).toContain('href="/assets/about-you-progressive.css"');
  });

  it('handles unexpected errors without leaking details', async () => {
    const errorLog = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const failingApp = createApp(
      { allowedOrigin: 'https://app.example.com' },
      (router) => {
        router.get('/failure', () => {
          throw new Error('secret');
        });
      },
    );
    const response = await request(failingApp).get('/failure').expect(500);
    expect(response.body).toEqual({
      error: 'internal_error',
      correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    expect(errorLog).toHaveBeenCalledOnce();
    errorLog.mockRestore();
  });
});

describe('organization-profile routes [onboarding-organization-profile REQ-001, REQ-006, REQ-007, REQ-011, REQ-012, REQ-018]', () => {
  const page = {
    submissionKey: 'x'.repeat(43),
    countries: countryOptions,
    industries: [...industryOptions],
    placesByIndustry: Object.fromEntries(
      Object.entries(placeServiceOptions).map(([key, values]) => [
        key,
        [...values],
      ]),
    ),
    sizes: [...organizationSizeOptions],
  };
  const input = {
    organizationName: 'Hansel',
    country: 'AU',
    industry: 'healthcare',
    placeService: 'clinics',
    organizationSize: 'employees_11_50',
    submissionKey: page.submissionKey,
  };
  const module = (overrides: Record<string, unknown> = {}) => ({
    createAccount: vi.fn(),
    verifyEmail: vi.fn(),
    resendVerification: vi.fn(),
    submitPersonalProfile: vi.fn(),
    load: vi.fn().mockResolvedValue(planPage),
    select: vi.fn(),
    loadOrganizationProfile: vi.fn().mockResolvedValue(page),
    submitOrganizationProfile: vi.fn().mockResolvedValue({
      nextStep: 'discovery',
      onboardingCredential: 'next',
      csrfProof: 'next-proof',
    }),
    recordOrganizationProfileEvent: vi.fn(),
    ...overrides,
  });
  const create = (overrides: Record<string, unknown> = {}, enabled = true) =>
    createApp(
      {
        allowedOrigin: 'https://app.example.com',
        organizationProfileEnabled: enabled,
      },
      undefined,
      module(overrides),
    );

  it('loads JSON and progressive HTML privately', async () => {
    const json = await request(create())
      .get('/api/onboarding/organization-profile')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(200);
    expect(json.body).toEqual(page);
    expect(json.headers['cache-control']).toBe('private, no-store');
    const html = await request(create())
      .get('/onboarding/organization-profile')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(200);
    expect(html.text).toContain('Now your organization');
    expect(html.text).toContain('Industry or sector');
    expect(html.text).not.toContain('>Back<');
  });

  it('prefills the saved organization profile on an authorized Back visit', async () => {
    const savedPage = {
      ...page,
      profile: {
        organizationName: 'Hansel saved',
        country: 'AU',
        industry: 'healthcare',
        placeService: 'clinics',
        organizationSize: 'employees_11_50',
      },
    };
    const html = await request(
      create({ loadOrganizationProfile: vi.fn().mockResolvedValue(savedPage) }),
    )
      .get('/onboarding/organization-profile')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(200);
    expect(html.text).toContain('value="Hansel saved"');
    expect(html.text).toContain('<option value="AU" selected>');
    expect(html.text).toContain('<option value="healthcare" selected>');
    expect(html.text).toContain(
      '<option value="clinics" data-industry="healthcare" selected>',
    );
    expect(html.text).toContain('<option value="employees_11_50" selected>');
  });

  it('submits JSON and native forms with rotated cookies', async () => {
    const cookies =
      'hansel_onboarding=credential; hansel_onboarding_csrf=proof';
    const json = await request(create())
      .post('/api/onboarding/organization-profile')
      .set('Origin', 'https://app.example.com')
      .set('x-hansel-csrf', 'proof')
      .set('Cookie', cookies)
      .send(input)
      .expect(200, { nextStep: 'discovery' });
    expect(String(json.headers['set-cookie'])).toContain(
      'hansel_onboarding=next',
    );
    await request(create())
      .post('/api/onboarding/organization-profile')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', cookies)
      .type('form')
      .send(input)
      .expect(303)
      .expect('Location', '/onboarding/discovery');
  });

  it('rejects disabled, missing, invalid, conflict, and stale requests safely', async () => {
    await request(create({}, false))
      .get('/api/onboarding/organization-profile')
      .expect(404);
    await request(create({}, false))
      .get('/onboarding/organization-profile')
      .expect(404);
    await request(create({}, false))
      .post('/api/onboarding/organization-profile')
      .send(input)
      .expect(404);
    await request(create())
      .get('/api/onboarding/organization-profile')
      .expect(401);
    await request(create()).get('/onboarding/organization-profile').expect(401);
    await request(create())
      .post('/api/onboarding/organization-profile')
      .send({})
      .expect(400);
    await request(create())
      .post('/api/onboarding/organization-profile')
      .set('Origin', 'https://evil.example')
      .send(input)
      .expect(401);
    await request(
      create({
        submitOrganizationProfile: vi
          .fn()
          .mockRejectedValue(new OrganizationProfileConflictError()),
      }),
    )
      .post('/api/onboarding/organization-profile')
      .set('Origin', 'https://app.example.com')
      .set('x-hansel-csrf', 'proof')
      .set(
        'Cookie',
        'hansel_onboarding=credential; hansel_onboarding_csrf=proof',
      )
      .send(input)
      .expect(409, { error: 'organization_profile_conflict' });
    await request(
      create({
        submitOrganizationProfile: vi
          .fn()
          .mockRejectedValue(new OrganizationProfileTransitionError()),
      }),
    )
      .post('/api/onboarding/organization-profile')
      .set('Origin', 'https://app.example.com')
      .set('x-hansel-csrf', 'proof')
      .set(
        'Cookie',
        'hansel_onboarding=credential; hansel_onboarding_csrf=proof',
      )
      .send(input)
      .expect(409, { error: 'onboarding_transition_failed' });
  });

  it('maps unavailable reads and progressive validation recovery', async () => {
    const unavailable = create({
      loadOrganizationProfile: vi
        .fn()
        .mockRejectedValue(new OrganizationProfileTransitionError()),
    });
    await request(unavailable)
      .get('/api/onboarding/organization-profile')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(409);
    await request(unavailable)
      .get('/onboarding/organization-profile')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(409);
    const recovery = await request(create())
      .post('/api/onboarding/organization-profile')
      .set('Origin', 'https://app.example.com')
      .set(
        'Cookie',
        'hansel_onboarding=credential; hansel_onboarding_csrf=proof',
      )
      .type('form')
      .send({ ...input, organizationName: '' })
      .expect(400);
    expect(recovery.text).toContain('could not save your organization');
  });

  it('records validation rejection without profile data', async () => {
    const feature = module();
    await request(
      createApp(
        {
          allowedOrigin: 'https://app.example.com',
          organizationProfileEnabled: true,
        },
        undefined,
        feature,
      ),
    )
      .post('/api/onboarding/organization-profile')
      .send({})
      .expect(400);
    expect(feature.recordOrganizationProfileEvent).toHaveBeenCalledWith(
      'organization_profile_validation_rejected',
    );
  });

  it('uses safe progressive fallbacks and preserves unexpected failures', async () => {
    const cookies =
      'hansel_onboarding=credential; hansel_onboarding_csrf=proof';
    const unavailable = await request(
      create({
        loadOrganizationProfile: vi
          .fn()
          .mockRejectedValue(new OrganizationProfileTransitionError()),
      }),
    )
      .post('/api/onboarding/organization-profile')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', cookies)
      .type('form')
      .send({ ...input, organizationName: '' })
      .expect(400);
    expect(unavailable.text).toBe('We could not save your organization.');

    const errorLog = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const failure = new Error('database unavailable');
    await request(
      create({ loadOrganizationProfile: vi.fn().mockRejectedValue(failure) }),
    )
      .get('/api/onboarding/organization-profile')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(500);
    await request(
      create({ loadOrganizationProfile: vi.fn().mockRejectedValue(failure) }),
    )
      .get('/onboarding/organization-profile')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(500);
    await request(
      create({
        loadOrganizationProfile: vi.fn().mockRejectedValue(failure),
      }),
    )
      .post('/api/onboarding/organization-profile')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', cookies)
      .type('form')
      .send({ ...input, organizationName: '' })
      .expect(500);
    await request(
      create({
        submitOrganizationProfile: vi.fn().mockRejectedValue(failure),
      }),
    )
      .post('/api/onboarding/organization-profile')
      .set('Origin', 'https://app.example.com')
      .set('x-hansel-csrf', 'proof')
      .set('Cookie', cookies)
      .send(input)
      .expect(500);
    expect(errorLog).toHaveBeenCalledTimes(4);
    errorLog.mockRestore();
  });
});

describe('onboarding account route [REQ-005, REQ-023, REQ-049]', () => {
  const verification = {
    verifyEmail: vi.fn(),
    resendVerification: vi.fn(),
    submitPersonalProfile: vi.fn(),
  };
  it('accepts a valid account request through the onboarding interface', async () => {
    const createAccount = vi
      .fn()
      .mockResolvedValue({ nextStep: 'verify-email' as const });
    const onboardingApp = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      { createAccount, ...verification },
    );

    await request(onboardingApp)
      .post('/api/onboarding/accounts')
      .send({
        email: 'OWNER@Example.com',
        password: 'Correct horse battery staple!7',
        acceptsTerms: true,
        termsVersion: '2026-08-27',
        privacyVersion: '2026-08-27',
      })
      .expect(202, { nextStep: 'verify-email' });

    expect(createAccount).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'Correct horse battery staple!7',
      acceptsTerms: true,
      termsVersion: '2026-08-27',
      privacyVersion: '2026-08-27',
    });
  });

  it('rejects invalid account input without invoking onboarding', async () => {
    const createAccount = vi.fn();
    const onboardingApp = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      { createAccount, ...verification },
    );

    await request(onboardingApp)
      .post('/api/onboarding/accounts')
      .send({
        email: 'owner@example.com',
        password: 'too short',
        acceptsTerms: true,
        termsVersion: '2026-08-27',
        privacyVersion: '2026-08-27',
      })
      .expect(400, { error: 'invalid_request' });

    expect(createAccount).not.toHaveBeenCalled();
  });

  it('verifies a valid code and accepts generic resend requests', async () => {
    const onboarding = {
      createAccount: vi.fn(),
      verifyEmail: vi.fn().mockResolvedValue({
        nextStep: 'personal-profile',
        onboardingCredential: 'opaque-credential',
        csrfProof: 'csrf-proof',
      }),
      resendVerification: vi.fn().mockResolvedValue({ status: 'accepted' }),
      submitPersonalProfile: vi.fn(),
    };
    const onboardingApp = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      onboarding,
    );
    const verificationResponse = await request(onboardingApp)
      .post('/api/onboarding/email-verification/verify')
      .send({ email: 'OWNER@example.com', code: '123456' })
      .expect(200, { nextStep: 'personal-profile' });
    expect(verificationResponse.headers['set-cookie']?.[0]).toContain(
      'hansel_onboarding=opaque-credential',
    );
    expect(verificationResponse.headers['set-cookie']?.[0]).toContain(
      'HttpOnly',
    );
    expect(verificationResponse.headers['set-cookie']?.[0]).toContain(
      'SameSite=Lax',
    );
    expect(verificationResponse.headers['set-cookie']?.[0]).toContain('Secure');
    expect(verificationResponse.headers['set-cookie']?.[1]).toContain(
      'hansel_onboarding_csrf=csrf-proof',
    );
    expect(verificationResponse.headers['set-cookie']?.[1]).toContain(
      'SameSite=Strict',
    );
    await request(onboardingApp)
      .post('/api/onboarding/email-verification/resend')
      .send({ email: 'OWNER@example.com' })
      .expect(202, { status: 'accepted' });
  });

  it('rejects malformed verification and resend requests', async () => {
    const onboarding = {
      createAccount: vi.fn(),
      verifyEmail: vi.fn(),
      resendVerification: vi.fn(),
      submitPersonalProfile: vi.fn(),
    };
    const onboardingApp = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      onboarding,
    );
    await request(onboardingApp)
      .post('/api/onboarding/email-verification/verify')
      .send({ email: 'bad', code: '12' })
      .expect(400, { error: 'invalid_request' });
    await request(onboardingApp)
      .post('/api/onboarding/email-verification/resend')
      .send({ email: 'bad' })
      .expect(400, { error: 'invalid_request' });
  });

  it('returns the generic verification failure', async () => {
    const onboardingApp = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      {
        createAccount: vi.fn(),
        verifyEmail: vi.fn().mockRejectedValue(new VerificationFailedError()),
        resendVerification: vi.fn(),
        submitPersonalProfile: vi.fn(),
      },
    );
    await request(onboardingApp)
      .post('/api/onboarding/email-verification/verify')
      .send({ email: 'owner@example.com', code: '123456' })
      .expect(400, { error: 'verification_failed' });
  });

  it('passes unexpected verification failures to the global handler', async () => {
    const errorLog = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const onboardingApp = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      {
        createAccount: vi.fn(),
        verifyEmail: vi.fn().mockRejectedValue(new Error('secret')),
        resendVerification: vi.fn(),
        submitPersonalProfile: vi.fn(),
      },
    );
    const response = await request(onboardingApp)
      .post('/api/onboarding/email-verification/verify')
      .send({ email: 'owner@example.com', code: '123456' })
      .expect(500);
    expect(response.body).toEqual({
      error: 'internal_error',
      correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    expect(errorLog).toHaveBeenCalledOnce();
    errorLog.mockRestore();
  });

  it('submits a validated profile using only the secure continuation cookie [REQ-054, REQ-086]', async () => {
    const submitPersonalProfile = vi
      .fn()
      .mockResolvedValue({ nextStep: 'plan-selection' });
    const onboardingApp = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      {
        createAccount: vi.fn(),
        verifyEmail: vi.fn(),
        resendVerification: vi.fn(),
        submitPersonalProfile,
      },
    );
    await request(onboardingApp)
      .post('/api/onboarding/personal-profile')
      .set('Origin', 'https://app.example.com')
      .set('x-hansel-csrf', 'csrf-proof')
      .set(
        'Cookie',
        'other=x; hansel_onboarding=opaque%2Dcredential; hansel_onboarding_csrf=csrf-proof',
      )
      .send({
        firstName: ' Nabin ',
        lastName: ' Singh ',
        jobTitle: 'manager',
        department: 'marketing_communications',
      })
      .expect(200, { nextStep: 'plan-selection' });
    expect(submitPersonalProfile).toHaveBeenCalledWith(
      'opaque-credential',
      'csrf-proof',
      {
        firstName: 'Nabin',
        lastName: 'Singh',
        jobTitle: 'manager',
        department: 'marketing_communications',
      },
    );
  });

  it('accepts a same-origin progressive profile submission with an opaque Origin [REQ-054, REQ-086]', async () => {
    const submitPersonalProfile = vi
      .fn()
      .mockResolvedValue({ nextStep: 'plan-selection' });
    const onboardingApp = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      {
        createAccount: vi.fn(),
        verifyEmail: vi.fn(),
        resendVerification: vi.fn(),
        submitPersonalProfile,
      },
    );

    await request(onboardingApp)
      .post('/api/onboarding/personal-profile')
      .type('form')
      .set('Origin', 'null')
      .set('Sec-Fetch-Site', 'same-origin')
      .set('Host', 'app.example.com')
      .set(
        'Cookie',
        'hansel_onboarding=opaque; hansel_onboarding_csrf=csrf-proof',
      )
      .send({
        firstName: 'Updated',
        lastName: 'Singh',
        jobTitle: 'manager',
        department: 'marketing_communications',
      })
      .expect(303)
      .expect('Location', '/onboarding/plan-selection');

    expect(submitPersonalProfile).toHaveBeenCalledWith(
      'opaque',
      'csrf-proof',
      expect.objectContaining({ firstName: 'Updated' }),
    );
  });

  it('loads the accepted profile using only the secure continuation cookie [REQ-011, REQ-014, REQ-086]', async () => {
    const profile = {
      firstName: 'Nabin',
      lastName: 'Singh',
      jobTitle: 'manager' as const,
      department: 'marketing_communications' as const,
    };
    const loadPersonalProfile = vi.fn().mockResolvedValue({ profile });
    const onboardingApp = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      {
        createAccount: vi.fn(),
        verifyEmail: vi.fn(),
        resendVerification: vi.fn(),
        loadPersonalProfile,
        submitPersonalProfile: vi.fn(),
      },
    );

    const response = await request(onboardingApp)
      .get('/api/onboarding/personal-profile')
      .set('Cookie', 'other=x; hansel_onboarding=opaque%2Dcredential')
      .expect('Cache-Control', 'private, no-store')
      .expect(200, { profile });

    expect(response.body).toEqual({ profile });
    expect(loadPersonalProfile).toHaveBeenCalledWith('opaque-credential');
  });

  it('prefills the progressive profile form from accepted server state [REQ-011, REQ-054]', async () => {
    const loadPersonalProfile = vi
      .fn()
      .mockResolvedValueOnce({
        profile: {
          firstName: 'Nabin',
          lastName: 'Singh',
          jobTitle: 'manager',
          department: 'marketing_communications',
        },
      })
      .mockResolvedValueOnce({ profile: null });
    const onboardingApp = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      {
        createAccount: vi.fn(),
        verifyEmail: vi.fn(),
        resendVerification: vi.fn(),
        loadPersonalProfile,
        submitPersonalProfile: vi.fn(),
      },
    );

    const response = await request(onboardingApp)
      .get('/onboarding/about-you')
      .set('Cookie', 'hansel_onboarding=opaque')
      .expect(200);

    expect(response.text).toContain('value="Nabin"');
    expect(response.text).toContain('value="manager" selected');
    await request(onboardingApp)
      .get('/onboarding/about-you')
      .set('Cookie', 'hansel_onboarding=opaque')
      .expect(200, /name="firstName"[^>]+value=""/);
  });

  it('rejects unavailable profile reads without exposing continuation details [REQ-086]', async () => {
    const module = (loadPersonalProfile: ReturnType<typeof vi.fn>) => ({
      createAccount: vi.fn(),
      verifyEmail: vi.fn(),
      resendVerification: vi.fn(),
      loadPersonalProfile,
      submitPersonalProfile: vi.fn(),
    });
    const missingCredential = vi.fn();
    const missingCredentialApp = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      module(missingCredential),
    );
    const expiredApi = await request(missingCredentialApp)
      .get('/api/onboarding/personal-profile')
      .expect(401, { error: 'onboarding_session_expired' });
    expect(expiredApi.headers['set-cookie']).toHaveLength(2);
    const expiredPage = await request(missingCredentialApp)
      .get('/onboarding/about-you')
      .expect('Location', '/onboarding')
      .expect(303);
    const expiredCookies = expiredPage.headers['set-cookie'] ?? [];
    expect(expiredCookies).toHaveLength(2);
    expect(expiredCookies[0]).toMatch(/^hansel_onboarding=;/);
    expect(expiredCookies[1]).toMatch(/^hansel_onboarding_csrf=;/);
    expect(missingCredential).not.toHaveBeenCalled();

    const staleApp = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      module(vi.fn().mockRejectedValue(new PersonalProfileTransitionError())),
    );
    const staleApi = await request(staleApp)
      .get('/api/onboarding/personal-profile')
      .set('Cookie', 'hansel_onboarding=stale')
      .expect(401, { error: 'onboarding_session_expired' });
    expect(staleApi.headers['set-cookie']).toHaveLength(2);
    const stalePage = await request(staleApp)
      .get('/onboarding/about-you')
      .set('Cookie', 'hansel_onboarding=stale')
      .expect('Location', '/onboarding')
      .expect(303);
    expect(stalePage.headers['set-cookie']).toHaveLength(2);

    const errorLog = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const unexpectedApp = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      module(vi.fn().mockRejectedValue(new Error('secret'))),
    );
    const response = await request(unexpectedApp)
      .get('/api/onboarding/personal-profile')
      .set('Cookie', 'hansel_onboarding=opaque')
      .expect(500);
    expect(response.body).toEqual({
      error: 'internal_error',
      correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    await request(unexpectedApp)
      .get('/onboarding/about-you')
      .set('Cookie', 'hansel_onboarding=opaque')
      .expect(500);
    expect(errorLog).toHaveBeenCalledTimes(2);
    errorLog.mockRestore();
  });

  it.each([
    [
      'missing cookie',
      'https://app.example.com',
      undefined,
      'onboarding_session_expired',
    ],
    [
      'wrong origin',
      'https://evil.example.com',
      'hansel_onboarding=opaque',
      'onboarding_transition_failed',
    ],
    [
      'mismatched CSRF proof',
      'https://app.example.com',
      'hansel_onboarding=opaque; hansel_onboarding_csrf=csrf-proof',
      'onboarding_transition_failed',
    ],
    [
      'malformed cookie',
      'https://app.example.com',
      'hansel_onboarding=%E0%A4%A',
      'onboarding_session_expired',
    ],
  ])(
    'rejects profile submission with %s',
    async (_name, origin, cookie, error) => {
      const submitPersonalProfile = vi.fn();
      const onboardingApp = createApp(
        { allowedOrigin: 'https://app.example.com' },
        undefined,
        {
          createAccount: vi.fn(),
          verifyEmail: vi.fn(),
          resendVerification: vi.fn(),
          submitPersonalProfile,
        },
      );
      const profileRequest = request(onboardingApp)
        .post('/api/onboarding/personal-profile')
        .set('Origin', origin);
      if (cookie) profileRequest.set('Cookie', cookie);
      const response = await profileRequest
        .send({
          firstName: 'Nabin',
          lastName: 'Singh',
          jobTitle: 'manager',
          department: 'marketing_communications',
        })
        .expect(401, { error });
      if (error === 'onboarding_session_expired')
        expect(response.headers['set-cookie']).toHaveLength(2);
      expect(submitPersonalProfile).not.toHaveBeenCalled();
    },
  );

  it('rejects invalid data and logs out a rejected transition', async () => {
    const submitPersonalProfile = vi
      .fn()
      .mockRejectedValue(new PersonalProfileTransitionError());
    const onboardingApp = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      {
        createAccount: vi.fn(),
        verifyEmail: vi.fn(),
        resendVerification: vi.fn(),
        submitPersonalProfile,
      },
    );
    const validRequest = () =>
      request(onboardingApp)
        .post('/api/onboarding/personal-profile')
        .set('Origin', 'https://app.example.com')
        .set('x-hansel-csrf', 'csrf-proof')
        .set(
          'Cookie',
          'hansel_onboarding=opaque; hansel_onboarding_csrf=csrf-proof',
        );
    await validRequest()
      .send({ firstName: '' })
      .expect(400, { error: 'invalid_request' });
    expect(submitPersonalProfile).not.toHaveBeenCalled();
    const expiredResponse = await validRequest()
      .send({
        firstName: 'Nabin',
        lastName: 'Singh',
        jobTitle: 'manager',
        department: 'marketing_communications',
      })
      .expect(401, { error: 'onboarding_session_expired' });
    expect(expiredResponse.headers['set-cookie']).toHaveLength(2);
  });

  it('passes unexpected profile failures to the global handler', async () => {
    const errorLog = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const onboardingApp = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      {
        createAccount: vi.fn(),
        verifyEmail: vi.fn(),
        resendVerification: vi.fn(),
        submitPersonalProfile: vi.fn().mockRejectedValue(new Error('secret')),
      },
    );
    const response = await request(onboardingApp)
      .post('/api/onboarding/personal-profile')
      .set('Origin', 'https://app.example.com')
      .set('x-hansel-csrf', 'csrf-proof')
      .set(
        'Cookie',
        'hansel_onboarding=opaque; hansel_onboarding_csrf=csrf-proof',
      )
      .send({
        firstName: 'Nabin',
        lastName: 'Singh',
        jobTitle: 'manager',
        department: 'marketing_communications',
      })
      .expect(500);
    expect(response.body).toEqual({
      error: 'internal_error',
      correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    expect(errorLog).toHaveBeenCalledOnce();
    errorLog.mockRestore();
  });

  it('supports native HTML form submission and recovery without JavaScript [REQ-054, REQ-086]', async () => {
    const submitPersonalProfile = vi
      .fn()
      .mockResolvedValue({ nextStep: 'plan-selection' });
    const onboardingApp = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      {
        createAccount: vi.fn(),
        verifyEmail: vi.fn(),
        resendVerification: vi.fn(),
        submitPersonalProfile,
      },
    );
    const nativeForm = () =>
      request(onboardingApp)
        .post('/api/onboarding/personal-profile')
        .set('Origin', 'https://app.example.com')
        .set(
          'Cookie',
          'hansel_onboarding=opaque; hansel_onboarding_csrf=csrf-proof',
        )
        .type('form');
    await nativeForm()
      .send({
        firstName: 'Nabin',
        lastName: 'Singh',
        jobTitle: 'manager',
        department: 'marketing_communications',
      })
      .expect('Location', '/onboarding/plan-selection')
      .expect(303);
    const recovery = await nativeForm()
      .send({
        firstName: `A&<>"'`,
        lastName: '',
        jobTitle: 'other',
        jobTitleOther: 'Founder',
        department: 'other',
        departmentOther: 'Strategy',
      })
      .expect('Content-Type', /html/)
      .expect(400, /Review the form/);
    expect(recovery.text).toContain('value="A&amp;&lt;&gt;&quot;&#39;"');
    expect(recovery.text).toContain('value="other" selected');
    expect(recovery.text).toContain(
      'name="jobTitleOther" maxlength="100" required value="Founder"',
    );
    expect(recovery.text).toContain(
      'name="departmentOther" maxlength="100" required value="Strategy"',
    );
    expect(submitPersonalProfile).toHaveBeenCalledWith(
      'opaque',
      'csrf-proof',
      expect.objectContaining({ firstName: 'Nabin' }),
    );

    submitPersonalProfile.mockRejectedValueOnce(
      new PersonalProfileTransitionError(),
    );
    const expiredResponse = await nativeForm()
      .send({
        firstName: 'Nabin',
        lastName: 'Singh',
        jobTitle: 'manager',
        department: 'marketing_communications',
      })
      .expect('Location', '/onboarding')
      .expect(303);
    expect(expiredResponse.headers['set-cookie']).toHaveLength(2);
  });

  it('logs out an expired native profile submission and returns to onboarding [REQ-086]', async () => {
    const submitPersonalProfile = vi.fn();
    const onboardingApp = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      {
        createAccount: vi.fn(),
        verifyEmail: vi.fn(),
        resendVerification: vi.fn(),
        submitPersonalProfile,
      },
    );

    const response = await request(onboardingApp)
      .post('/api/onboarding/personal-profile')
      .set('Origin', 'https://app.example.com')
      .type('form')
      .send({
        firstName: 'Nabin',
        lastName: 'Singh',
        jobTitle: 'manager',
        department: 'marketing_communications',
      })
      .expect('Location', '/onboarding')
      .expect(303);

    expect(response.headers['set-cookie']).toHaveLength(2);
    expect(submitPersonalProfile).not.toHaveBeenCalled();
  });
});

describe('plan-selection routes [onboarding-plan-selection REQ-006, REQ-007, REQ-008, REQ-011, REQ-012, REQ-013]', () => {
  const module = (overrides: Record<string, unknown> = {}) => ({
    createAccount: vi.fn(),
    verifyEmail: vi.fn(),
    resendVerification: vi.fn(),
    submitPersonalProfile: vi.fn(),
    load: vi.fn().mockResolvedValue(planPage),
    select: vi.fn().mockResolvedValue({
      nextStep: 'payment',
      onboardingCredential: 'next-credential',
      csrfProof: 'next-proof',
    }),
    ...overrides,
  });
  const create = (overrides: Record<string, unknown> = {}) =>
    createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      module(overrides),
    );

  it('keeps every plan-selection route behind the rollout flag [onboarding-plan-selection REQ-018]', async () => {
    const app = createApp(
      { allowedOrigin: 'https://app.example.com', planSelectionEnabled: false },
      undefined,
      module(),
    );
    await request(app)
      .get('/api/onboarding/plan-selection')
      .expect(404, { error: 'not_found' });
    await request(app)
      .get('/onboarding/plan-selection')
      .expect(404, /Not found/);
    await request(app)
      .post('/api/onboarding/plan-selection')
      .send({ priceId: 'free' })
      .expect(404, { error: 'not_found' });
  });

  it('loads private JSON and progressive HTML with annual and monthly views', async () => {
    const onboarding = module();
    const app = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      onboarding,
    );
    const json = await request(app)
      .get('/api/onboarding/plan-selection')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(200);
    expect(json.headers['cache-control']).toBe('private, no-store');
    expect(json.body).toEqual(planPage);
    const html = await request(app)
      .get('/onboarding/plan-selection?interval=monthly')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(200);
    expect(html.headers['cache-control']).toBe('private, no-store');
    expect(html.text).toContain('Welcome Nabin, choose your plan');
    expect(html.text).toContain('value="plus_monthly"');
    expect(html.text).not.toContain('value="plus_annual"');
    expect(html.text).toContain('Or try it for free');
    await request(app)
      .get('/onboarding/plan-selection')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(200, /value="plus_annual"/);
  });

  it('rejects missing or invalid read continuations generically', async () => {
    await request(create())
      .get('/api/onboarding/plan-selection')
      .expect(401, { error: 'onboarding_transition_failed' });
    await request(create())
      .get('/onboarding/plan-selection')
      .expect(401, /session unavailable/i);
    const rejected = create({
      load: vi.fn().mockRejectedValue(new PlanSelectionTransitionError()),
    });
    await request(rejected)
      .get('/api/onboarding/plan-selection')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(409, { error: 'onboarding_transition_failed' });
    await request(rejected)
      .get('/onboarding/plan-selection')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(409, /session unavailable/i);
  });

  it('passes unexpected plan read failures to the global handler', async () => {
    const errorLog = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const app = create({
      load: vi.fn().mockRejectedValue(new Error('secret')),
    });
    await request(app)
      .get('/api/onboarding/plan-selection')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(500);
    await request(app)
      .get('/onboarding/plan-selection')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(500);
    expect(errorLog).toHaveBeenCalledTimes(2);
    errorLog.mockRestore();
  });

  it.each([
    ['plus_annual', { nextStep: 'payment' }, '/onboarding/payment'],
    [
      'free',
      { nextStep: 'organization-profile' },
      '/onboarding/organization-profile',
    ],
    [
      'enterprise',
      {
        nextStep: 'contact-sales',
        destination: 'https://sales.example.com/hansel',
      },
      'https://sales.example.com/hansel',
    ],
  ] as const)(
    'submits %s for JSON and native form clients',
    async (priceId, result, destination) => {
      const select = vi.fn().mockResolvedValue({
        ...result,
        onboardingCredential: 'next-credential',
        csrfProof: 'next-proof',
      });
      const app = create({ select });
      const cookies =
        'hansel_onboarding=credential; hansel_onboarding_csrf=proof';
      const response = await request(app)
        .post('/api/onboarding/plan-selection')
        .set('Origin', 'https://app.example.com')
        .set('x-hansel-csrf', 'proof')
        .set('Cookie', cookies)
        .send({ priceId })
        .expect(200, result);
      expect(String(response.headers['set-cookie'])).toContain(
        'hansel_onboarding=next-credential',
      );
      await request(app)
        .post('/api/onboarding/plan-selection')
        .set('Origin', 'https://app.example.com')
        .set('Cookie', cookies)
        .type('form')
        .send({ priceId })
        .expect(303)
        .expect('Location', destination);
      expect(select).toHaveBeenCalledWith('credential', 'proof', { priceId });
    },
  );

  it('rejects malformed, unauthenticated, and rejected transitions while preserving the HTML form', async () => {
    const select = vi
      .fn()
      .mockRejectedValue(new PlanSelectionTransitionError());
    const app = create({ select });
    await request(app)
      .post('/api/onboarding/plan-selection')
      .send({ priceId: 'unknown' })
      .expect(400, { error: 'invalid_request' });
    await request(app)
      .post('/api/onboarding/plan-selection')
      .set('Origin', 'https://evil.example.com')
      .send({ priceId: 'free' })
      .expect(401, { error: 'onboarding_transition_failed' });
    const recovery = await request(app)
      .post('/api/onboarding/plan-selection')
      .set('Origin', 'https://app.example.com')
      .set(
        'Cookie',
        'hansel_onboarding=credential; hansel_onboarding_csrf=proof',
      )
      .type('form')
      .send({ priceId: 'plus_annual' })
      .expect(409);
    expect(recovery.text).toContain('We could not save your plan');
    expect(recovery.text).toContain('value="plus_annual"');
    expect(recovery.text).toContain(
      '<article class="plan" aria-current="true"><h2>Plus</h2>',
    );
  });

  it('accepts an opaque browser origin only for a same-origin native form', async () => {
    const cookies =
      'hansel_onboarding=credential; hansel_onboarding_csrf=proof';
    await request(create())
      .post('/api/onboarding/plan-selection')
      .set('Origin', 'null')
      .set('Sec-Fetch-Site', 'same-origin')
      .set('Host', 'app.example.com')
      .set('Cookie', cookies)
      .type('form')
      .send({ priceId: 'free' })
      .expect(303);
    await request(create())
      .post('/api/onboarding/plan-selection')
      .set('Origin', 'null')
      .set('Sec-Fetch-Site', 'cross-site')
      .set('Host', 'app.example.com')
      .set('Cookie', cookies)
      .type('form')
      .send({ priceId: 'free' })
      .expect(401);
    await request(create())
      .post('/api/onboarding/plan-selection')
      .set('Origin', 'null')
      .set('Sec-Fetch-Site', 'same-origin')
      .set('Host', 'evil.example.com')
      .set('Cookie', cookies)
      .type('form')
      .send({ priceId: 'free' })
      .expect(401);
    await request(create())
      .post('/api/onboarding/plan-selection')
      .set('Origin', 'https://evil.example.com')
      .set('Cookie', cookies)
      .type('form')
      .send({ priceId: 'free' })
      .expect(401);
  });

  it('recovers native-form failures when state cannot be reloaded and propagates unexpected selections', async () => {
    const errorLog = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const unavailable = create({
      load: vi.fn().mockRejectedValue(new PlanSelectionTransitionError()),
      select: vi.fn().mockRejectedValue(new PlanSelectionTransitionError()),
    });
    await request(unavailable)
      .post('/api/onboarding/plan-selection')
      .set('Origin', 'https://app.example.com')
      .set(
        'Cookie',
        'hansel_onboarding=credential; hansel_onboarding_csrf=proof',
      )
      .type('form')
      .send({ priceId: 'free' })
      .expect(409, /could not save your plan/i);
    await request(create())
      .post('/api/onboarding/plan-selection')
      .set('Origin', 'https://app.example.com')
      .type('form')
      .send({ priceId: 'unknown' })
      .expect(400, /could not save your plan/i);
    await request(create())
      .post('/api/onboarding/plan-selection')
      .set('Origin', 'https://app.example.com')
      .set(
        'Cookie',
        'hansel_onboarding=credential; hansel_onboarding_csrf=proof',
      )
      .type('form')
      .send({ priceId: 'unknown' })
      .expect(400, /Welcome Nabin, choose your plan/);
    await request(
      create({ load: vi.fn().mockRejectedValue(new Error('load secret')) }),
    )
      .post('/api/onboarding/plan-selection')
      .set('Origin', 'https://app.example.com')
      .set(
        'Cookie',
        'hansel_onboarding=credential; hansel_onboarding_csrf=proof',
      )
      .type('form')
      .send({ priceId: 'unknown' })
      .expect(500);
    await request(
      create({ select: vi.fn().mockRejectedValue(new Error('secret')) }),
    )
      .post('/api/onboarding/plan-selection')
      .set('Origin', 'https://app.example.com')
      .set('x-hansel-csrf', 'proof')
      .set(
        'Cookie',
        'hansel_onboarding=credential; hansel_onboarding_csrf=proof',
      )
      .send({ priceId: 'free' })
      .expect(500);
    expect(errorLog).toHaveBeenCalledTimes(2);
    errorLog.mockRestore();
  });
});
