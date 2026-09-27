import { describe, expect, it, vi } from 'vitest';
import {
  createOnboardingAccount,
  getHealth,
  resendOnboardingVerification,
  loadPlanSelection,
  selectOnboardingPlan,
  verifyOnboardingEmail,
  loadPersonalProfile,
  submitPersonalProfile,
  loadOrganizationProfile,
  OnboardingSessionExpiredError,
  submitOrganizationProfile,
  loadDiscovery,
  completeDiscovery,
  loadDashboard,
  logoutDashboard,
  DashboardAuthenticationRequiredError,
  login,
  LoginAuthenticationError,
  requestPasswordRecovery,
  resetPassword,
  PasswordResetRejectedError,
  createSite,
  loadSiteActivity,
  loadSites,
  loadAllocationPlans,
  loadAllocationPlanContent,
  createAllocationPlanUploadBatch,
  uploadAllocationPlan,
  finalizeAllocationPlanUpload,
  loadSignageSchedule,
  createSignType,
  updateSignType,
  createSign,
  updateSign,
  loadSiteActivityPage,
  createSiteComment,
} from './api.js';
import {
  countryOptions,
  discoveryManagementOptions,
  industryOptions,
  organizationSizeOptions,
  placeServiceOptions,
} from '@hansel/contracts';

describe('sites API [sites-add-new REQ-007..REQ-016]', () => {
  const siteId = 'ad96f8c1-e7f8-4fbb-a057-1c98ee4539a9';

  it('loads sites, creates one, and loads its activity contract', async () => {
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
      members: [],
      sites: [],
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(page)))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            siteId,
            destination: `/sites/${siteId}/activity`,
          }),
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ site: { id: siteId, name: 'New site' } }),
        ),
      );
    const input = {
      idempotencyKey: 'site-request-00000000000000000001',
      name: 'New site',
      accessScope: 'ORGANIZATION' as const,
      organizationAccess: 'VIEW_COMMENT' as const,
    };

    await expect(loadSites('', fetcher)).resolves.toEqual(page);
    await expect(createSite(input, '', fetcher)).resolves.toEqual({
      siteId,
      destination: `/sites/${siteId}/activity`,
    });
    await expect(loadSiteActivity(siteId, '', fetcher)).resolves.toEqual({
      site: { id: siteId, name: 'New site' },
    });
    expect(fetcher).toHaveBeenNthCalledWith(2, '/api/sites', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
  });

  it('maps authentication and server-owned create rejections', async () => {
    const unauthorized = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 401 }));
    await expect(loadSites('', unauthorized)).rejects.toBeInstanceOf(
      DashboardAuthenticationRequiredError,
    );
    await expect(
      loadSiteActivity(siteId, '', unauthorized),
    ).rejects.toBeInstanceOf(DashboardAuthenticationRequiredError);
    await expect(
      createSite(
        {
          idempotencyKey: 'site-request-00000000000000000001',
          name: 'New site',
          accessScope: 'ORGANIZATION',
          organizationAccess: 'VIEW_COMMENT',
        },
        '',
        unauthorized,
      ),
    ).rejects.toBeInstanceOf(DashboardAuthenticationRequiredError);

    const limited = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: 'sites_upgrade_required' }), {
        status: 409,
      }),
    );
    await expect(
      createSite(
        {
          idempotencyKey: 'site-request-00000000000000000001',
          name: 'New site',
          accessScope: 'ORGANIZATION',
          organizationAccess: 'VIEW_COMMENT',
        },
        '',
        limited,
      ),
    ).rejects.toMatchObject({
      code: 'sites_upgrade_required',
    });

    const unknown = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'private_provider_error' }), {
          status: 503,
        }),
      )
      .mockResolvedValueOnce(new Response('not-json', { status: 503 }));
    const request = {
      idempotencyKey: 'site-request-00000000000000000001',
      name: 'New site',
      accessScope: 'ORGANIZATION' as const,
      organizationAccess: 'VIEW_COMMENT' as const,
    };
    await expect(createSite(request, '', unknown)).rejects.toMatchObject({
      code: 'sites_unavailable',
    });
    await expect(createSite(request, '', unknown)).rejects.toMatchObject({
      code: 'sites_unavailable',
    });
    const unavailableRead = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 503 }));
    await expect(loadSites('', unavailableRead)).rejects.toThrow(
      'sites_load_failed',
    );
    await expect(loadSiteActivity(siteId, '', unavailableRead)).rejects.toThrow(
      'site_activity_load_failed',
    );
  });
});

describe('signage schedule API [site-signage-schedule REQ-016]', () => {
  const siteId = 'ad96f8c1-e7f8-4fbb-a057-1c98ee4539a9';
  const typeId = '00000000-0000-4000-8000-000000000010';
  const now = '2026-09-06T00:00:00.000Z';
  const sign = {
    id: '00000000-0000-4000-8000-000000000011',
    signTypeId: typeId,
    code: 'A.1',
    quantity: 1,
    location: '',
    content: '',
    comments: '',
    createdAt: now,
    updatedAt: now,
  };
  const type = {
    id: typeId,
    name: 'Regulatory',
    color: 'RED',
    createdAt: now,
    updatedAt: now,
    quantityTotal: 1,
    signs: [sign],
  };

  it('loads and mutates using exact JSON contracts', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ canManageSigns: true, signTypes: [type] }),
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(type)))
      .mockResolvedValueOnce(new Response(JSON.stringify(type)))
      .mockResolvedValueOnce(new Response(JSON.stringify(sign)))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...sign, quantity: 2 })),
      );
    await expect(
      loadSignageSchedule(siteId, '', fetcher),
    ).resolves.toMatchObject({ canManageSigns: true });
    await createSignType(siteId, 'Regulatory', '', fetcher);
    await updateSignType(siteId, type as never, 'Safety', '', fetcher);
    await createSign(siteId, typeId, 'A.1', '', fetcher);
    // signage-schedule-remove-status REQ-003: no legacy field is sent.
    expect(fetcher.mock.calls.at(-1)?.[1]?.body).toBe(
      JSON.stringify({
        code: 'A.1',
        quantity: 1,
        location: '',
        content: '',
        comments: '',
      }),
    );
    await updateSign(siteId, sign, 'quantity', 2, '', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  it('rejects categorical request failures', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 409 }));
    await expect(loadSignageSchedule(siteId, '', fetcher)).rejects.toThrow(
      'signage_schedule_failed',
    );
    fetcher.mockResolvedValue(new Response(null, { status: 401 }));
    await expect(
      loadSignageSchedule(siteId, '', fetcher),
    ).rejects.toBeInstanceOf(DashboardAuthenticationRequiredError);
  });
});

describe('Site Activity API [site-activity-feed-comments REQ-007..REQ-010]', () => {
  const siteId = 'ad96f8c1-e7f8-4fbb-a057-1c98ee4539a9';
  const item = {
    id: '00000000-0000-4000-8000-000000000050',
    kind: 'SITE_COMMENT_ADDED' as const,
    commentText: 'Hello team',
    actor: { displayName: 'Owner', initials: 'O' },
    createdAt: '2026-09-06T00:00:00.000Z',
  };

  it('loads pages and submits strict comment JSON', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [item], nextCursor: null })),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(item), { status: 201 }),
      );
    await expect(
      loadSiteActivityPage(siteId, null, '', fetcher),
    ).resolves.toMatchObject({
      items: [item],
    });
    await expect(
      createSiteComment(siteId, 'Hello team', '', fetcher),
    ).resolves.toEqual(item);
    expect(fetcher).toHaveBeenLastCalledWith(
      `/api/sites/${siteId}/comments`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ text: 'Hello team' }),
      }),
    );
  });
});

describe('Allocation Plans API [site-allocation-plans-add REQ-006..REQ-017]', () => {
  const siteId = 'ad96f8c1-e7f8-4fbb-a057-1c98ee4539a9';
  const uploadId = '00000000-0000-4000-8000-000000000005';
  const requestBody = {
    idempotencyKey: 'x'.repeat(32),
    files: [
      {
        filename: 'plan.pdf',
        mediaType: 'application/pdf' as const,
        byteSize: 5,
        checksumSha256: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      },
    ],
  };
  const intent = {
    uploads: [
      {
        uploadId,
        uploadUrl: 'https://uploads.example/plan',
        expiresAt: '2026-09-06T00:15:00.000Z',
        headers: {
          'content-type': 'application/pdf' as const,
          'x-amz-checksum-sha256':
            'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        },
      },
    ],
  };
  const plan = {
    id: '00000000-0000-4000-8000-000000000006',
    filename: 'plan.pdf',
    mediaType: 'application/pdf' as const,
    byteSize: 5,
    createdAt: '2026-09-06T00:00:00.000Z',
    modifiedAt: '2026-09-06T00:00:00.000Z',
    uploadedBy: 'Owner',
  };

  it('loads, creates, uploads, and finalizes through bounded requests [AC-001]', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ canAddPlans: true, plans: [] })),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(intent), { status: 201 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ plan })));
    await expect(
      loadAllocationPlans(siteId, '', fetcher),
    ).resolves.toMatchObject({ canAddPlans: true });
    await expect(
      createAllocationPlanUploadBatch(siteId, requestBody, '', fetcher),
    ).resolves.toEqual(intent);
    const file = new File(['%PDF-'], 'plan.pdf', { type: 'application/pdf' });
    const [uploadIntent] = intent.uploads;
    if (!uploadIntent) throw new Error('Expected upload intent');
    await uploadAllocationPlan(
      uploadIntent.uploadUrl,
      file,
      uploadIntent.headers,
      fetcher,
    );
    await expect(
      finalizeAllocationPlanUpload(siteId, uploadId, '', fetcher),
    ).resolves.toEqual({ plan });
  });

  it('loads private Allocation Plan preview bytes [site-allocation-plan-preview AC-001, AC-003]', async () => {
    const loaded = await loadAllocationPlanContent(
      siteId,
      plan.id,
      '',
      vi
        .fn()
        .mockResolvedValue(
          new Response('png', { headers: { 'content-type': 'image/png' } }),
        ),
    );
    expect(loaded.type).toBe('image/png');
    expect(loaded.size).toBe(3);
    await expect(
      loadAllocationPlanContent(
        siteId,
        plan.id,
        '',
        vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
      ),
    ).rejects.toThrow('allocation_plan_preview_failed');
  });

  it('maps disabled, expired, and unavailable operations safely [AC-002, AC-003]', async () => {
    await expect(
      loadAllocationPlans(
        siteId,
        '',
        vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
      ),
    ).resolves.toEqual({ canAddPlans: false, plans: [] });
    for (const operation of [
      (fetcher: typeof fetch) => loadAllocationPlans(siteId, '', fetcher),
      (fetcher: typeof fetch) =>
        createAllocationPlanUploadBatch(siteId, requestBody, '', fetcher),
      (fetcher: typeof fetch) =>
        finalizeAllocationPlanUpload(siteId, uploadId, '', fetcher),
      (fetcher: typeof fetch) =>
        loadAllocationPlanContent(siteId, plan.id, '', fetcher),
    ]) {
      await expect(
        operation(
          vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
        ),
      ).rejects.toBeInstanceOf(DashboardAuthenticationRequiredError);
      await expect(
        operation(
          vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
        ),
      ).rejects.toThrow();
    }
    await expect(
      uploadAllocationPlan(
        'https://uploads.example/plan',
        new File(['x'], 'x.pdf'),
        {},
        vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
      ),
    ).rejects.toThrow('allocation_plan_upload_failed');
  });

  it('reports browser upload progress and maps transport outcomes [site-allocation-plans-add REQ-019]', async () => {
    type Listener = (event: ProgressEvent) => void;
    const listeners = new Map<string, Listener>();
    const uploadListeners = new Map<string, Listener>();
    const request = {
      status: 200,
      open: vi.fn(),
      setRequestHeader: vi.fn(),
      send: vi.fn(),
      abort: vi.fn(() => {
        listeners.get('abort')?.(new ProgressEvent('abort'));
      }),
      addEventListener: (name: string, listener: Listener) => {
        listeners.set(name, listener);
      },
      upload: {
        addEventListener: (name: string, listener: Listener) => {
          uploadListeners.set(name, listener);
        },
      },
    };
    vi.stubGlobal(
      'XMLHttpRequest',
      vi.fn(() => request),
    );
    const progress = vi.fn();
    const controller = new AbortController();
    const file = new File(['plan'], 'plan.pdf');
    const successful = uploadAllocationPlan(
      'https://uploads.example/plan',
      file,
      { 'content-type': 'application/pdf' },
      fetch,
      { onProgress: progress, signal: controller.signal },
    );
    uploadListeners.get('progress')?.(
      new ProgressEvent('progress', { lengthComputable: false }),
    );
    uploadListeners.get('progress')?.(
      new ProgressEvent('progress', {
        lengthComputable: true,
        loaded: 45,
        total: 100,
      }),
    );
    listeners.get('load')?.(new ProgressEvent('load'));
    await expect(successful).resolves.toBeUndefined();
    expect(progress).toHaveBeenCalledWith(45);
    expect(request.setRequestHeader).toHaveBeenCalledWith(
      'content-type',
      'application/pdf',
    );
    expect(request.send).toHaveBeenCalledWith(file);

    for (const outcome of ['load', 'error'] as const) {
      request.status = 503;
      const failed = uploadAllocationPlan(
        'https://uploads.example/plan',
        file,
        {},
        fetch,
        { onProgress: progress, signal: new AbortController().signal },
      );
      listeners.get(outcome)?.(new ProgressEvent(outcome));
      await expect(failed).rejects.toThrow('allocation_plan_upload_failed');
    }

    const cancelController = new AbortController();
    const cancelled = uploadAllocationPlan(
      'https://uploads.example/plan',
      file,
      {},
      fetch,
      { onProgress: progress, signal: cancelController.signal },
    );
    cancelController.abort();
    await expect(cancelled).rejects.toThrow('allocation_plan_upload_cancelled');
    expect(request.abort).toHaveBeenCalledOnce();
  });
});

describe('login API [user-login REQ-003, REQ-004, REQ-008]', () => {
  it('submits credentials and strictly parses the server-owned destination', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ destination: '/dashboard' }), {
        status: 200,
      }),
    );
    const input = {
      email: 'owner@example.com',
      password: 'Correct horse battery staple!7',
    };

    await expect(login(input, '', fetcher)).resolves.toEqual({
      destination: '/dashboard',
    });
    expect(fetcher).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
  });

  it('distinguishes generic rejection from temporary unavailability', async () => {
    const rejected = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 401 }));
    const unavailable = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 503 }));

    await expect(
      login({ email: 'owner@example.com', password: 'wrong' }, '', rejected),
    ).rejects.toBeInstanceOf(LoginAuthenticationError);
    await expect(
      login(
        { email: 'owner@example.com', password: 'anything' },
        '',
        unavailable,
      ),
    ).rejects.toThrow('login_unavailable');
  });
});

describe('password recovery API [password-recovery REQ-004, REQ-010, REQ-016]', () => {
  it('submits the generic request and closed reset result', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'accepted' }), { status: 202 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ destination: '/login' }), {
          status: 200,
        }),
      );
    await expect(
      requestPasswordRecovery({ email: 'owner@example.com' }, '', fetcher),
    ).resolves.toEqual({ status: 'accepted' });
    await expect(
      resetPassword(
        {
          email: 'owner@example.com',
          code: '123456',
          password: 'Correct horse battery staple!7',
        },
        '',
        fetcher,
      ),
    ).resolves.toEqual({ destination: '/login' });
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      '/api/auth/password-recovery/request',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      '/api/auth/password-recovery/reset',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('distinguishes reset rejection from temporary failure', async () => {
    const rejected = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 400 }));
    const unavailable = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 503 }));
    const input = {
      email: 'owner@example.com',
      code: '123456',
      password: 'Correct horse battery staple!7',
    };
    await expect(resetPassword(input, '', rejected)).rejects.toBeInstanceOf(
      PasswordResetRejectedError,
    );
    await expect(resetPassword(input, '', unavailable)).rejects.toThrow(
      'password_reset_unavailable',
    );
    await expect(
      requestPasswordRecovery({ email: input.email }, '', unavailable),
    ).rejects.toThrow('password_recovery_unavailable');
  });
});

describe('dashboard API [dashboard-home REQ-007, REQ-012, REQ-013]', () => {
  it('logs out with one credentialed bodyless POST [dashboard-logout REQ-004]', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));

    await expect(logoutDashboard('', fetcher)).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledWith('/api/dashboard/logout', {
      method: 'POST',
      credentials: 'include',
    });
  });

  it('maps rejected logout to one retryable client error [dashboard-logout REQ-010]', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 503 }));

    await expect(logoutDashboard('', fetcher)).rejects.toThrow(
      'dashboard_logout_failed',
    );
  });

  it('loads and strictly parses the private viewer with credentials', async () => {
    const result = {
      viewer: {
        displayName: 'Nabin Singh',
        initials: 'NS',
        roleLabel: 'Owner',
      },
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(result), { status: 200 }));

    await expect(loadDashboard('', fetcher)).resolves.toEqual(result);
    expect(fetcher).toHaveBeenCalledWith('/api/dashboard', {
      credentials: 'include',
    });
  });

  it('distinguishes authentication expiry from a retryable failure', async () => {
    const unauthenticated = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 401 }));
    const unavailable = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 503 }));

    await expect(loadDashboard('', unauthenticated)).rejects.toBeInstanceOf(
      DashboardAuthenticationRequiredError,
    );
    await expect(loadDashboard('', unavailable)).rejects.toThrow(
      'dashboard_load_failed',
    );
  });
});

describe('discovery API [onboarding-discovery REQ-006, REQ-007, REQ-010, REQ-013]', () => {
  const page = {
    submissionKey: 'x'.repeat(43),
    methods: [...discoveryManagementOptions],
  };
  const input = {
    action: 'submit' as const,
    currentManagement: 'pdf' as const,
    challenges: 'Version control',
    submissionKey: page.submissionKey,
  };

  it('loads and completes with credentials and CSRF', async () => {
    document.cookie = 'hansel_onboarding_csrf=proof%20value';
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(page), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            nextStep: 'dashboard',
            destination: '/dashboard',
          }),
          { status: 200 },
        ),
      );
    await expect(loadDiscovery('', fetcher)).resolves.toEqual(page);
    await expect(completeDiscovery(input, '', fetcher)).resolves.toEqual({
      nextStep: 'dashboard',
      destination: '/dashboard',
    });
    expect(fetcher).toHaveBeenLastCalledWith('/api/onboarding/discovery', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-hansel-csrf': 'proof value',
      },
      body: JSON.stringify(input),
    });
  });

  it('maps load, completion, missing-CSRF, and expired-session failures', async () => {
    const failed = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 409 }));
    await expect(loadDiscovery('', failed)).rejects.toThrow(
      'discovery_load_failed',
    );
    document.cookie = 'hansel_onboarding_csrf=proof';
    await expect(completeDiscovery(input, '', failed)).rejects.toThrow(
      'discovery_failed',
    );
    document.cookie = 'hansel_onboarding_csrf=; Max-Age=0';
    const unused = vi.fn<typeof fetch>();
    await expect(completeDiscovery(input, '', unused)).rejects.toBeInstanceOf(
      OnboardingSessionExpiredError,
    );
    expect(unused).not.toHaveBeenCalled();
    const expired = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 401 }));
    await expect(loadDiscovery('', expired)).rejects.toBeInstanceOf(
      OnboardingSessionExpiredError,
    );
    document.cookie = 'hansel_onboarding_csrf=proof';
    await expect(completeDiscovery(input, '', expired)).rejects.toBeInstanceOf(
      OnboardingSessionExpiredError,
    );
  });
});

describe('personal profile API [REQ-011, REQ-014]', () => {
  it('loads the accepted profile with credentials', async () => {
    const result = {
      profile: {
        firstName: 'Nabin',
        lastName: 'Singh',
        jobTitle: 'manager' as const,
        department: 'marketing_communications' as const,
      },
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(result), { status: 200 }));

    await expect(loadPersonalProfile('', fetcher)).resolves.toEqual(result);
    expect(fetcher).toHaveBeenCalledWith('/api/onboarding/personal-profile', {
      method: 'GET',
      credentials: 'include',
    });
  });

  it('maps an unavailable profile load', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 409 }));

    await expect(loadPersonalProfile('', fetcher)).rejects.toThrow(
      'personal_profile_load_failed',
    );
  });

  it('identifies an expired personal-profile session [REQ-086]', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 401 }));

    await expect(loadPersonalProfile('', fetcher)).rejects.toBeInstanceOf(
      OnboardingSessionExpiredError,
    );
  });
});

describe('organization profile API [onboarding-organization-profile REQ-006, REQ-007, REQ-011]', () => {
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
    industry: 'healthcare' as const,
    placeService: 'clinics',
    organizationSize: 'employees_11_50' as const,
    submissionKey: page.submissionKey,
  };
  it('loads and submits with credentials and CSRF', async () => {
    document.cookie = 'hansel_onboarding_csrf=proof';
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(page), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ nextStep: 'discovery' }), {
          status: 200,
        }),
      );
    await expect(loadOrganizationProfile('', fetcher)).resolves.toEqual(page);
    await expect(
      submitOrganizationProfile(input, '', fetcher),
    ).resolves.toEqual({ nextStep: 'discovery' });
    expect(fetcher).toHaveBeenLastCalledWith(
      '/api/onboarding/organization-profile',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });
  it('maps load and submit failures', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 409 }));
    await expect(loadOrganizationProfile('', fetcher)).rejects.toThrow(
      'organization_profile_load_failed',
    );
    await expect(submitOrganizationProfile(input, '', fetcher)).rejects.toThrow(
      'organization_profile_failed',
    );
  });
});

describe('plan selection API [onboarding-plan-selection REQ-006, REQ-007]', () => {
  const plan = (
    priceId:
      | 'free'
      | 'plus_monthly'
      | 'plus_annual'
      | 'pro_monthly'
      | 'pro_annual'
      | 'enterprise',
  ) => ({
    priceId,
    planId:
      priceId === 'free'
        ? ('free' as const)
        : priceId.startsWith('plus')
          ? ('plus' as const)
          : priceId.startsWith('pro')
            ? ('pro' as const)
            : ('enterprise' as const),
    displayName: 'Plan',
    description: 'Description',
    features: ['Feature one', 'Feature two', 'Feature three'],
    billingInterval: priceId.endsWith('monthly')
      ? ('monthly' as const)
      : priceId.endsWith('annual')
        ? ('annual' as const)
        : null,
    currency: 'USD' as const,
    amountMinor: priceId === 'enterprise' ? null : 0,
    monthlyEquivalentMinor: priceId === 'enterprise' ? null : 0,
    additionalSiteAmountMinor: null,
    paymentRequired: priceId !== 'free' && priceId !== 'enterprise',
    maximumSites: priceId === 'free' ? 1 : null,
    contactSales: priceId === 'enterprise',
  });
  const page = {
    firstName: 'Nabin',
    selectedInterval: 'annual' as const,
    selectedPriceId: null,
    plans: (
      [
        'free',
        'plus_monthly',
        'plus_annual',
        'pro_monthly',
        'pro_annual',
        'enterprise',
      ] as const
    ).map(plan),
  };

  it('loads private plan state and submits a CSRF-protected selection', async () => {
    document.cookie = 'hansel_onboarding_csrf=proof%20value';
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(page), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ nextStep: 'payment' }), { status: 200 }),
      );
    await expect(
      loadPlanSelection('https://api.example', fetcher),
    ).resolves.toEqual(page);
    await expect(
      selectOnboardingPlan('plus_annual', 'https://api.example', fetcher),
    ).resolves.toEqual({ nextStep: 'payment' });
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      'https://api.example/api/onboarding/plan-selection',
      { credentials: 'include' },
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      'https://api.example/api/onboarding/plan-selection',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: expect.objectContaining({ 'x-hansel-csrf': 'proof value' }),
        body: JSON.stringify({ priceId: 'plus_annual' }),
      }),
    );
  });

  it('maps load, submit, and missing-CSRF failures to stable errors', async () => {
    const failed = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 409 }));
    await expect(loadPlanSelection('', failed)).rejects.toThrow(
      'plan_selection_load_failed',
    );
    document.cookie = 'hansel_onboarding_csrf=proof';
    await expect(selectOnboardingPlan('free', '', failed)).rejects.toThrow(
      'plan_selection_failed',
    );
    document.cookie = 'hansel_onboarding_csrf=; Max-Age=0';
    const unused = vi.fn<typeof fetch>();
    await expect(selectOnboardingPlan('free', '', unused)).rejects.toThrow(
      'csrf_proof_missing',
    );
    expect(unused).not.toHaveBeenCalled();
  });
});

describe('getHealth [REQ-002]', () => {
  it('parses a successful response', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ status: 'ok' }), { status: 200 }),
      );
    await expect(getHealth('https://api.example', fetcher)).resolves.toEqual({
      status: 'ok',
    });
    expect(fetcher).toHaveBeenCalledWith('https://api.example/api/health');
  });

  it('rejects an unsuccessful response', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 503 }));
    await expect(getHealth('', fetcher)).rejects.toThrow(
      'Health request failed with 503',
    );
  });
});

describe('personal profile API [REQ-086]', () => {
  const input = {
    firstName: 'Nabin',
    lastName: 'Singh',
    jobTitle: 'manager' as const,
    department: 'marketing_communications' as const,
  };
  it('posts the profile with the continuation cookie', async () => {
    document.cookie = 'hansel_onboarding_csrf=csrf-proof';
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ nextStep: 'plan-selection' }), {
        status: 200,
      }),
    );
    await expect(
      submitPersonalProfile(input, 'https://api.example', fetcher),
    ).resolves.toEqual({ nextStep: 'plan-selection' });
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.example/api/onboarding/personal-profile',
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          'x-hansel-csrf': 'csrf-proof',
        },
        body: JSON.stringify(input),
      },
    );
  });
  it('maps unsuccessful responses to a stable error', async () => {
    document.cookie = 'hansel_onboarding_csrf=csrf-proof';
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 409 }));
    await expect(submitPersonalProfile(input, '', fetcher)).rejects.toThrow(
      'personal_profile_failed',
    );
  });
  it('identifies an expired session before sending without CSRF proof', async () => {
    document.cookie = 'hansel_onboarding_csrf=; Max-Age=0';
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      submitPersonalProfile(input, '', fetcher),
    ).rejects.toBeInstanceOf(OnboardingSessionExpiredError);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('identifies an expired session returned while saving', async () => {
    document.cookie = 'hansel_onboarding_csrf=csrf-proof';
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 401 }));
    await expect(
      submitPersonalProfile(input, '', fetcher),
    ).rejects.toBeInstanceOf(OnboardingSessionExpiredError);
    expect(fetcher).toHaveBeenCalledOnce();
  });
});

describe('verification API [REQ-006, REQ-007]', () => {
  it('posts verify and resend contracts', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ nextStep: 'personal-profile' }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'accepted' }), { status: 202 }),
      );
    await expect(
      verifyOnboardingEmail(
        { email: 'owner@example.com', code: '123456' },
        '',
        fetcher,
      ),
    ).resolves.toEqual({ nextStep: 'personal-profile' });
    await expect(
      resendOnboardingVerification({ email: 'owner@example.com' }, '', fetcher),
    ).resolves.toEqual({ status: 'accepted' });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('maps failed verify and resend transports to stable errors', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 400 }));
    await expect(
      verifyOnboardingEmail(
        { email: 'owner@example.com', code: '123456' },
        '',
        fetcher,
      ),
    ).rejects.toThrow('verification_failed');
    await expect(
      resendOnboardingVerification({ email: 'owner@example.com' }, '', fetcher),
    ).rejects.toThrow('resend_failed');
  });
});

describe('createOnboardingAccount [REQ-005, REQ-049]', () => {
  it('posts and parses the shared onboarding contract', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ nextStep: 'verify-email' }), {
        status: 202,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const input = {
      email: 'owner@example.com',
      password: 'Correct horse battery staple!7',
      acceptsTerms: true as const,
      termsVersion: '2026-08-27',
      privacyVersion: '2026-08-27',
    };

    await expect(
      createOnboardingAccount(input, 'https://api.example', fetcher),
    ).resolves.toEqual({ nextStep: 'verify-email' });
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.example/api/onboarding/accounts',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      },
    );
  });

  it('rejects an unsuccessful account request', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 400 }));

    await expect(
      createOnboardingAccount(
        {
          email: 'owner@example.com',
          password: 'Correct horse battery staple!7',
          acceptsTerms: true,
          termsVersion: '2026-08-27',
          privacyVersion: '2026-08-27',
        },
        '',
        fetcher,
      ),
    ).rejects.toThrow('Account request failed with 400');
  });
});
